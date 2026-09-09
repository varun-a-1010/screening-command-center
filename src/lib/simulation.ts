export type Phase = "healthy" | "incident" | "recovering";

export type VenueReading = {
  id: string;
  city: string;
  venue: string;
  viewers: number;
  impacted: number;
  rebufferRatio: number;
  errorRate: number;
  startupSeconds: number;
  originLatencyMs: number;
  throughputMbps: number;
  rendition: string;
  state: "clear" | "degraded" | "recovering";
};

export type TimelineEvent = {
  id: string;
  at: string;
  kind: "system" | "warning" | "action" | "recovery";
  title: string;
  detail: string;
};

export type SimulationState = {
  phase: Phase;
  scenario: string;
  release: string;
  startedAt: number;
  changedAt: number;
  sequence: number;
  timeline: TimelineEvent[];
};

const globalSimulation = globalThis as typeof globalThis & { screeningSimulation?: SimulationState };

function event(kind: TimelineEvent["kind"], title: string, detail: string): TimelineEvent {
  return { id: crypto.randomUUID(), at: new Date().toISOString(), kind, title, detail };
}

export function getSimulation(): SimulationState {
  if (!globalSimulation.screeningSimulation) {
    const now = Date.now();
    globalSimulation.screeningSimulation = {
      phase: "healthy",
      scenario: "none",
      release: "edge-2026.09.09.4",
      startedAt: now,
      changedAt: now,
      sequence: 0,
      timeline: [event("system", "Screening simulation started", "Four simulated venues; Grafana delivery is checked separately.")],
    };
  }
  return globalSimulation.screeningSimulation;
}

export function injectFault() {
  const state = getSimulation();
  if (state.phase === "incident") return state;
  state.phase = "incident";
  state.scenario = "rendition_manifest_mismatch";
  state.release = "edge-2026.09.09.5";
  state.changedAt = Date.now();
  state.timeline.unshift(event("warning", "Audience impact detected in Mumbai", "4K segment errors rose after edge release .5; other venues remain stable."));
  return state;
}

export function beginRecovery() {
  const state = getSimulation();
  if (state.phase === "healthy") return state;
  state.phase = "recovering";
  state.release = "edge-2026.09.09.4";
  state.changedAt = Date.now();
  state.timeline.unshift(event("action", "Operator rolled back the edge manifest", "Mumbai traffic is returning to the last known-good release."));
  return state;
}

function jitter(seed: number, scale: number) {
  return Math.sin(seed * 1.73) * scale;
}

export function sampleReadings(): { state: SimulationState; venues: VenueReading[]; observedAt: string } {
  const state = getSimulation();
  state.sequence += 1;
  if (state.phase === "recovering" && Date.now() - state.changedAt > 25_000) {
    state.phase = "healthy";
    state.scenario = "none";
    state.changedAt = Date.now();
    state.timeline.unshift(event("recovery", "Simulation returned to baseline", "Recovery is not yet verified. Run a Grafana investigation to check post-rollback evidence."));
  }

  const base = [
    { id: "mum", city: "Mumbai", venue: "Regal Screen 1", viewers: 2840, rendition: "2160p" },
    { id: "sin", city: "Singapore", venue: "Capitol Theatre", viewers: 1960, rendition: "1080p" },
    { id: "lon", city: "London", venue: "Curzon Mayfair", viewers: 2320, rendition: "1080p" },
    { id: "ber", city: "Berlin", venue: "Kino International", viewers: 1780, rendition: "1080p" },
  ];

  const elapsed = (Date.now() - state.changedAt) / 1000;
  const recoveryFactor = state.phase === "recovering" ? Math.max(0, 1 - elapsed / 25) : state.phase === "incident" ? 1 : 0;
  const venues = base.map((venue, index): VenueReading => {
    const affected = venue.id === "mum" ? recoveryFactor : 0;
    const noise = jitter(state.sequence + index, 0.08);
    return {
      ...venue,
      impacted: Math.max(0, Math.round(venue.viewers * affected * 0.29)),
      rebufferRatio: Math.max(0.002, 0.009 + noise / 100 + affected * 0.128),
      errorRate: Math.max(0.0004, 0.0015 + noise / 200 + affected * 0.217),
      startupSeconds: 1.08 + noise + affected * 3.4,
      originLatencyMs: Math.round(116 + noise * 40 + affected * 19),
      throughputMbps: Math.max(3, 26 + noise * 5 - affected * 7),
      state: affected > 0.5 ? "degraded" : affected > 0.03 ? "recovering" : "clear",
    };
  });
  return { state, venues, observedAt: new Date().toISOString() };
}
