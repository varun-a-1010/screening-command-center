"""Bounded Gemini failover for one inference, preserving agent/tool history."""
import asyncio
import logging
import os
import random

from google.adk.models.google_llm import Gemini
from google.genai import types

TRANSIENT = {429, 500, 502, 503, 504}


def model_chain():
    primary = os.getenv("GEMINI_MODEL", "gemini-3.8-flash").strip() or "gemini-3.8-flash"
    extras = os.getenv("GEMINI_FALLBACK_MODELS", "gemini-3.7-flash,gemini-3.6-flash")
    return list(dict.fromkeys([primary, *[m.strip() for m in extras.split(",") if m.strip()]]))


def transient(error):
    seen = set()
    while error is not None and id(error) not in seen:
        seen.add(id(error))
        if any(getattr(error, key, None) in TRANSIENT for key in ("code", "status", "status_code")):
            return True
        error = error.__cause__
    return False


class ResilientGemini(Gemini):
    async def generate_content_async(self, llm_request, stream=False):
        for model in model_chain():
            adapter = Gemini(model=model, retry_options=types.HttpRetryOptions(attempts=1))
            for attempt in range(2):
                emitted = False
                # ADK preprocessing mutates requests. Each attempt gets a clean copy.
                request = llm_request.model_copy(deep=True)
                request.model = model
                try:
                    async for response in adapter.generate_content_async(request, stream=stream):
                        emitted = True
                        yield response
                    return
                except Exception as error:
                    # Never replay after partial content or tool calls reached the caller.
                    if emitted or not transient(error):
                        raise
                    last_error = error
                    logging.getLogger(__name__).warning(
                        "Gemini transient failure: model=%s attempt=%s", model, attempt + 1
                    )
                    if attempt == 0:
                        await asyncio.sleep(1 + random.random())
        raise last_error
