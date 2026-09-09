#!/bin/sh
set -eu
PYTHONPATH=agent .venv/bin/adk api_server --auto_create_session --session_service_uri memory:// --artifact_service_uri memory:// --host 127.0.0.1 --port 8300 agent &
agent_pid=$!
trap 'kill "$agent_pid" 2>/dev/null || true' EXIT INT TERM
.venv/bin/python - <<'PY'
import time
import urllib.request
for attempt in range(90):
    try:
        with urllib.request.urlopen("http://127.0.0.1:8300/list-apps", timeout=2) as response:
            if response.status == 200:
                break
    except Exception:
        time.sleep(1)
else:
    raise SystemExit("ADK service did not become ready")
PY
node server.js
