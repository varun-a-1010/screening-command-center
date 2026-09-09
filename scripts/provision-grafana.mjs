const grafanaUrl = process.env.GRAFANA_URL;
const token = process.env.GRAFANA_SERVICE_ACCOUNT_TOKEN;
if (!grafanaUrl || !token) throw new Error("GRAFANA_URL and GRAFANA_SERVICE_ACCOUNT_TOKEN are required.");

const dashboard = {
  uid: "screening-command-center",
  title: "Screening Command Center — Premiere Operations",
  tags: ["agentic-cinema", "screening-operations", "gemini"],
  timezone: "browser",
  schemaVersion: 39,
  refresh: "5s",
  time: { from: "now-15m", to: "now" },
  annotations: { list: [] },
  templating: { list: [] },
  panels: [
    {
      id: 1, type: "stat", title: "Viewers impacted now", gridPos: { x: 0, y: 0, w: 6, h: 5 },
      datasource: { type: "prometheus", uid: "grafanacloud-prom" },
      targets: [{ refId: "A", expr: "sum(screening_impacted_viewers)", instant: true }],
      fieldConfig: { defaults: { color: { mode: "thresholds" }, thresholds: { mode: "absolute", steps: [{ color: "green", value: null }, { color: "red", value: 1 }] } }, overrides: [] },
      options: { reduceOptions: { values: false, calcs: ["lastNotNull"] }, colorMode: "value", graphMode: "area", textMode: "auto" },
    },
    {
      id: 2, type: "stat", title: "Audience watching", gridPos: { x: 6, y: 0, w: 6, h: 5 },
      datasource: { type: "prometheus", uid: "grafanacloud-prom" },
      targets: [{ refId: "A", expr: "sum(screening_active_viewers)", instant: true }],
      fieldConfig: { defaults: { color: { mode: "continuous-GrYlRd" } }, overrides: [] },
      options: { reduceOptions: { values: false, calcs: ["lastNotNull"] }, colorMode: "none", graphMode: "area" },
    },
    {
      id: 3, type: "timeseries", title: "Segment error rate by city", gridPos: { x: 12, y: 0, w: 12, h: 8 },
      datasource: { type: "prometheus", uid: "grafanacloud-prom" },
      targets: [{ refId: "A", expr: "max by (city, rendition, release) (screening_segment_error_rate)", legendFormat: "{{city}} · {{rendition}} · {{release}}" }],
      fieldConfig: { defaults: { unit: "percentunit", min: 0 }, overrides: [] },
    },
    {
      id: 4, type: "timeseries", title: "Rebuffer ratio by venue", gridPos: { x: 0, y: 5, w: 12, h: 8 },
      datasource: { type: "prometheus", uid: "grafanacloud-prom" },
      targets: [{ refId: "A", expr: "max by (city, venue) (screening_rebuffer_ratio)", legendFormat: "{{city}} · {{venue}}" }],
      fieldConfig: { defaults: { unit: "percentunit", min: 0 }, overrides: [] },
    },
    {
      id: 5, type: "logs", title: "Playback gateway evidence", gridPos: { x: 12, y: 8, w: 12, h: 10 },
      datasource: { type: "loki", uid: "grafanacloud-logs" },
      targets: [{ refId: "A", expr: "{service_name=\"screening-gateway\"}", queryType: "range" }],
      options: { showTime: true, showLabels: true, wrapLogMessage: true, sortOrder: "Descending", dedupStrategy: "none" },
    },
    {
      id: 6, type: "timeseries", title: "Origin latency vs CDN throughput", gridPos: { x: 0, y: 13, w: 12, h: 5 },
      datasource: { type: "prometheus", uid: "grafanacloud-prom" },
      targets: [
        { refId: "A", expr: "max by (city) (screening_origin_latency_ms)", legendFormat: "Origin latency · {{city}}" },
        { refId: "B", expr: "max by (city) (screening_cdn_throughput_mbps)", legendFormat: "CDN throughput · {{city}}" },
      ],
      fieldConfig: { defaults: {}, overrides: [] },
    },
  ],
};

const response = await fetch(`${grafanaUrl}/api/dashboards/db`, {
  method: "POST",
  headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
  body: JSON.stringify({ dashboard, overwrite: true, message: "Provision Agentic Cinema screening operations dashboard" }),
});
const payload = await response.json();
if (!response.ok) throw new Error(`Grafana dashboard provisioning failed (${response.status}): ${JSON.stringify(payload)}`);
console.log(`${grafanaUrl}${payload.url}`);

