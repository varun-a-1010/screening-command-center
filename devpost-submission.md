## Inspiration

When a premiere or virtual screening starts buffering, an operator needs more than a red dashboard. Who is affected? Is the fault isolated to a rendition, a venue, or a release? What should be tried, and what evidence would demonstrate recovery?

Screening Command Center brings those questions into an incident investigation workflow for media-delivery operations.

## What it does

The demo follows a four-location screening network. An operator introduces a simulated 4K manifest fault, asks Gemini to investigate the evidence in Grafana, and can roll back the simulated release.

The workbench shows audience impact, segment errors, rebuffering, and release context. Its editable investigation field includes examples for audience impact, competing explanations, cross-location comparison, and post-rollback checks.

The report presents a diagnosis, confidence, supporting measurements, three competing hypotheses, a recommended operator action, and a caveat. An expandable evidence inspector shows the Grafana MCP arguments and returned responses behind the investigation.

## How I built it

The Next.js application generates bounded screening telemetry and sends it through OpenTelemetry HTTP ingestion to Grafana Cloud. Prometheus-compatible metrics and Loki logs share screening, location, rendition, and release labels.

A Python agent built with Google's Agent Development Kit uses Gemini 3.8 Flash on Vertex AI. It calls the official Grafana MCP server at runtime to discover data sources and query operational evidence. The MCP server is configured to disable writes, and an agent callback bounds the tool-call budget.

The UI's rollback control changes the simulation; it does not execute the model's recommendation against a production system. A fresh investigation remains available after the simulation returns to baseline.

## What is real in the demo

The screening, audience counts, release fault, and rollback are simulated. Grafana Cloud ingestion, the Gemini investigation, and the MCP queries are real.

The connection indicator reports whether metrics and logs were accepted, independently of the simulation's health. An accepted upload does not guarantee that every signal is immediately queryable.

The recorded investigation identified 824 simulated affected viewers in Mumbai and produced a report from actual Grafana responses. It also left an alternative explanation open and noted that detailed logs had not been inspected within its call budget. The video preserves that limitation rather than replacing it with a perfect canned answer.

## Challenges I ran into

A live-looking interface can make stronger claims than the backend supports. The prototype now distinguishes returning to a simulated baseline from verified recovery, and telemetry delivery failures from healthy operation.

The other challenge was making agent reasoning inspectable. Raw tool responses are shown alongside queries so an operator can challenge the report. The model can still overstate causality; comparative metrics alone are not proof of a deployment defect.

## Accomplishments

The prototype connects fault injection, actual Grafana telemetry, a Gemini investigation, inspectable evidence, and an operator-controlled rollback in one application.

The standalone repository includes application and agent source, a Grafana dashboard provisioning script, environment configuration, container deployment files, and an MIT license. Lint and a production build passed before publication.

## What I learned

The important distinction is not between a dashboard and a chat interface. It is between a status display and an investigation that makes its evidence and uncertainty visible. Recovery deserves a new evidentiary check, not just a green indicator.

## What's next

Improve query planning so the agent reserves enough budget for logs, validate claim-to-query references, and evaluate incident and recovery reports against explicit criteria.

This demo has shared, process-local state and generates telemetry while the page is open. A production version would use durable per-incident state, independent telemetry collection, authentication, and stronger usage controls.

## Testing

1. Open the app and wait for the Grafana delivery status.
2. Inject the simulated 4K manifest fault.
3. Run an investigation; allow time for the Grafana queries and model response.
4. Inspect the report, hypotheses, and raw MCP evidence.
5. Roll back the release, allow the simulation to settle, and ask a post-rollback question.

The demonstration is not a real cinema outage and does not perform production remediation.

Source and setup: https://github.com/varun-a-1010/screening-command-center

