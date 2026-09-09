import { z } from "zod";

const schema = z.object({ query: z.string().trim().min(10).max(600) });

export async function POST(request: Request) {
  try {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter an investigation request between 10 and 600 characters." }, { status: 400 });
  const upstream = await fetch(`${process.env.ADK_BASE_URL ?? "http://127.0.0.1:8300"}/run_sse`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      appName: "screening_command_center",
      userId: "premiere-operator",
      sessionId: crypto.randomUUID(),
      streaming: false,
      newMessage: { role: "user", parts: [{ text: parsed.data.query }] },
    }),
    signal: AbortSignal.timeout(600_000),
  });
  if (!upstream.ok || !upstream.body) return Response.json({ error: "The incident agent is unavailable." }, { status: 502 });

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalText = "";
  const calls: Array<{ name: string; args: unknown; response?: unknown }> = [];
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
    let split;
    while ((split = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, split); buffer = buffer.slice(split + 2);
      const data = frame.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
      if (!data || data === "[DONE]") continue;
      const event = JSON.parse(data);
      for (const part of event.content?.parts ?? []) {
        if (part.functionCall) calls.push({ name: part.functionCall.name, args: part.functionCall.args });
        if (part.functionResponse) {
          const match = [...calls].reverse().find((call) => call.name === part.functionResponse.name && call.response === undefined);
          if (match) match.response = part.functionResponse.response;
        }
        if (part.text && !part.thought && !event.partial) finalText = part.text;
      }
    }
    if (done) break;
  }
  if (!finalText) return Response.json({ error: "The agent finished without an incident report.", calls }, { status: 502 });
  const report = JSON.parse(finalText.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  return Response.json({ report, calls });
  } catch {
    return Response.json({ error: "The investigation could not finish or returned an invalid report. Check the agent connection and retry." }, { status: 502 });
  }
}
