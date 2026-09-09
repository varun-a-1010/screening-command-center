import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
from types import SimpleNamespace

spec = importlib.util.spec_from_file_location("fallback", next((Path(__file__).resolve().parents[1] / "agent").glob("*/resilient_model.py")))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class Failure(Exception):
    def __init__(self, code):
        self.code = code

class Request:
    model = "primary"
    def model_copy(self, deep=False):
        return Request()

class Tests(unittest.IsolatedAsyncioTestCase):
    async def run_case(self, outcomes):
        calls = []
        class Adapter:
            def __init__(self, model, **kwargs):
                self.model = model
            async def generate_content_async(self, request, stream=False):
                calls.append((self.model, request.model))
                value = outcomes.pop(0)
                if isinstance(value, Exception):
                    raise value
                yield value
        async def no_sleep(_):
            pass
        with patch.object(module, "Gemini", Adapter), patch.object(module, "model_chain", return_value=["primary", "backup"]), patch.object(module.asyncio, "sleep", no_sleep):
            results = [r async for r in module.ResilientGemini(model="primary").generate_content_async(Request())]
        return results, calls

    async def test_fallback(self):
        result, calls = await self.run_case([Failure(429), Failure(503), "ok"])
        self.assertEqual(result, ["ok"])
        self.assertEqual(calls, [("primary", "primary"), ("primary", "primary"), ("backup", "backup")])

    async def test_primary_success(self):
        result, calls = await self.run_case(["ok"])
        self.assertEqual(len(calls), 1)

    async def test_bad_request_not_retried(self):
        with self.assertRaises(Failure):
            await self.run_case([Failure(400)])

    async def test_exhaustion(self):
        with self.assertRaises(Failure):
            await self.run_case([Failure(429)] * 4)

    async def test_no_replay_after_partial(self):
        class Adapter:
            def __init__(self, **kwargs): pass
            async def generate_content_async(self, request, stream=False):
                yield "partial"
                raise Failure(503)
        with patch.object(module, "Gemini", Adapter):
            values = []
            with self.assertRaises(Failure):
                async for value in module.ResilientGemini(model="primary").generate_content_async(Request()):
                    values.append(value)
            self.assertEqual(values, ["partial"])

if __name__ == "__main__":
    unittest.main()
