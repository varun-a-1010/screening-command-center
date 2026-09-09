import { sampleReadings } from "@/lib/simulation";
import { publishTelemetry } from "@/lib/telemetry";

export const dynamic = "force-dynamic";

export async function GET() {
  const sample = sampleReadings();
  const delivery = await publishTelemetry(sample.venues, sample.state);
  return Response.json({ ...sample, delivery, grafanaUrl: process.env.GRAFANA_DASHBOARD_URL ?? process.env.GRAFANA_URL ?? "" });
}
