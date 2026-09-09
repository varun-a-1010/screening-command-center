#!/bin/sh
set -eu
PYTHONPATH=agent .venv/bin/adk api_server --auto_create_session --session_service_uri memory:// --artifact_service_uri memory:// --host 127.0.0.1 --port 8300 agent &
agent_pid=$!
trap 'kill "$agent_pid" 2>/dev/null || true' EXIT INT TERM
node server.js
