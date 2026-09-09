# Screening Command Center

A live incident-command agent for film premieres, festival screenings, and virtual cinema events. The product generates operational screening telemetry, publishes it to Grafana Cloud, and asks Gemini on Vertex AI to investigate the incident through the official Grafana MCP server.

## The operator loop

1. Four international screening venues report healthy playback.
2. The operator injects a rendition-manifest fault affecting Mumbai's 4K audience.
3. Metrics and logs are sent to Grafana Cloud through OTLP.
4. Gemini uses Grafana MCP at runtime to establish audience impact, compare venues, and test competing explanations.
5. The operator rolls back the edge release.
6. The system publishes recovery telemetry; a second investigation verifies whether the evidence supports recovery.

This is intentionally different from a retrospective warehouse investigation. Its job is active incident response: determine who is affected now, recommend a reversible intervention, and verify the result.

## Partner and Google Cloud runtime

- **Grafana Cloud:** Prometheus-compatible metrics, Loki logs, dashboards, and runtime evidence.
- **Official `mcp-grafana`:** invoked over stdio by Google ADK; a service-account token permits unattended deployment.
- **Google ADK:** orchestrates the multi-step investigation and MCP calls.
- **Gemini 3.8 Flash on Vertex AI:** evaluates competing hypotheses and returns the structured incident decision.
- **Cloud Run:** target hosting for the web application and ADK agent.

AI Observability can be added as a complementary view, but the qualifying integration is the runtime Grafana MCP connection.

## Local development

Copy `.env.example` to `.env.local`, fill in Grafana and Google Cloud values, then install:

```bash
npm install
python3 -m venv .venv
.venv/bin/pip install -r agent/requirements.txt
python3 -m venv .mcp-venv
.mcp-venv/bin/pip install -r agent/mcp-requirements.txt
npm run dev
```

The command center runs at <http://localhost:3300>. The ADK service runs at port 8300.

Provision the judge-facing Grafana dashboard:

```bash
set -a; . ./.env.local; set +a
node scripts/provision-grafana.mjs
```

## Evidence model

### Demo operating limits

Screening measurements are simulated; Grafana ingestion and MCP queries are real.
The UI reports metrics/log delivery separately from the simulation state. An OTLP
acceptance is not proof that data is already queryable. Returning to baseline after
rollback is not automatic recovery verification: run a fresh investigation.

Simulation state is process-local and resets on restart. Run one server instance
for this prototype; it is not a multi-instance production service. Browser polling
generates samples while the page is open. Before production, move simulation/session
state to shared storage and telemetry generation to an independent worker. Multiple
operators currently share the same demo state.

The simulator publishes these metrics with venue, city, screening, rendition, CDN, release, and scenario labels:

- `screening_active_viewers`
- `screening_impacted_viewers`
- `screening_rebuffer_ratio`
- `screening_segment_error_rate`
- `screening_startup_seconds`
- `screening_origin_latency_ms`
- `screening_cdn_throughput_mbps`

Loki receives bounded playback-health and segment-error events with matching labels. The agent is instructed not to claim causality and must identify unsupported hypotheses.
