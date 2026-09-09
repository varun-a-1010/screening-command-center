import { z } from "zod";
import { beginRecovery, injectFault, sampleReadings } from "@/lib/simulation";
import { publishTelemetry } from "@/lib/telemetry";

const schema = z.object({ action: z.enum(["inject", "recover"]) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Unknown control action." }, { status: 400 });
  if (parsed.data.action === "inject") injectFault();
  else beginRecovery();
  const sample = sampleReadings();
  await publishTelemetry(sample.venues, sample.state);
  return Response.json(sample);
}

