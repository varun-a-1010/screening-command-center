import type { SimulationState, VenueReading } from "./simulation";

function endpoint(path: string) {
  return `${(process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "").replace(/\/$/, "")}/${path}`;
}

function authHeader() {
  const configured = process.env.OTEL_EXPORTER_OTLP_HEADERS ?? "";
  if (/^authorization=/i.test(configured)) {
    const value = configured.slice(configured.indexOf("=") + 1).trim();
    return /^Basic\s+/i.test(value) ? value : `Basic ${value}`;
  }
  return configured ? `Basic ${configured}` : "";
}

function attributes(venue: VenueReading, state: SimulationState) {
  return [
    { key: "venue", value: { stringValue: venue.venue } },
    { key: "city", value: { stringValue: venue.city } },
    { key: "screening", value: { stringValue: "The Last Broadcast · World Premiere" } },
    { key: "rendition", value: { stringValue: venue.rendition } },
    { key: "cdn", value: { stringValue: "Aster Edge" } },
    { key: "release", value: { stringValue: state.release } },
    { key: "scenario", value: { stringValue: state.scenario } },
  ];
}

async function send(path: string, body: unknown) {
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT || !process.env.OTEL_EXPORTER_OTLP_HEADERS) throw new Error("Grafana telemetry is not configured");
  const response = await fetch(endpoint(path), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: authHeader() },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Grafana OTLP ${path} returned ${response.status}`);
  const bodyText = await response.text();
  const result = bodyText.trim() ? JSON.parse(bodyText) : {};
  if (result.partialSuccess && Object.values(result.partialSuccess).some(value => value !== 0 && value !== "0" && value !== "")) {
    throw new Error("Grafana partially rejected telemetry");
  }
}

export async function publishTelemetry(venues: VenueReading[], state: SimulationState) {
  const now = `${BigInt(Date.now()) * BigInt(1_000_000)}`;
  const resource = { attributes: [
    { key: "service.name", value: { stringValue: "screening-gateway" } },
    { key: "service.namespace", value: { stringValue: "cinema-operations" } },
    { key: "deployment.environment", value: { stringValue: "premiere" } },
  ] };
  const specs: Array<[string, (venue: VenueReading) => number]> = [
    ["screening_active_viewers", (v) => v.viewers],
    ["screening_impacted_viewers", (v) => v.impacted],
    ["screening_rebuffer_ratio", (v) => v.rebufferRatio],
    ["screening_segment_error_rate", (v) => v.errorRate],
    ["screening_startup_seconds", (v) => v.startupSeconds],
    ["screening_origin_latency_ms", (v) => v.originLatencyMs],
    ["screening_cdn_throughput_mbps", (v) => v.throughputMbps],
  ];
  const metrics = specs.map(([name, read]) => ({
    name,
    gauge: { dataPoints: venues.map((venue) => ({ timeUnixNano: now, asDouble: read(venue), attributes: attributes(venue, state) })) },
  }));
  const logRecords = venues.map((venue) => ({
    timeUnixNano: now,
    severityNumber: venue.impacted ? 17 : 9,
    severityText: venue.impacted ? "ERROR" : "INFO",
    body: { stringValue: venue.impacted
      ? `playback_segment_error venue=${venue.city} rendition=${venue.rendition} status=503 error_code=MANIFEST_RENDITION_MISMATCH release=${state.release}`
      : `playback_health venue=${venue.city} rendition=${venue.rendition} status=200 release=${state.release}` },
    attributes: [
      ...attributes(venue, state),
      { key: "event", value: { stringValue: venue.impacted ? "playback_segment_error" : "playback_health" } },
      { key: "status", value: { intValue: venue.impacted ? "503" : "200" } },
      { key: "error_code", value: { stringValue: venue.impacted ? "MANIFEST_RENDITION_MISMATCH" : "none" } },
      { key: "impacted_viewers", value: { intValue: `${venue.impacted}` } },
    ],
  }));

  const results = await Promise.allSettled([
    send("v1/metrics", { resourceMetrics: [{ resource, scopeMetrics: [{ scope: { name: "screening-simulator" }, metrics }] }] }),
    send("v1/logs", { resourceLogs: [{ resource, scopeLogs: [{ scope: { name: "screening-simulator" }, logRecords }] }] }),
  ]);
  return {
    metrics: results[0].status === "fulfilled",
    logs: results[1].status === "fulfilled",
    checkedAt: new Date().toISOString(),
  };
}
