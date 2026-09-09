"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import type { Phase, TimelineEvent, VenueReading } from "@/lib/simulation";

type Status = {
  state: { phase: Phase; scenario: string; release: string; timeline: TimelineEvent[] };
  venues: VenueReading[];
  observedAt: string;
  grafanaUrl: string;
  delivery: { metrics: boolean; logs: boolean; checkedAt: string };
};

type Report = {
  headline: string;
  severity: "critical" | "major" | "minor" | "healthy";
  affected_audience: string;
  diagnosis: string;
  confidence: "high" | "medium" | "low";
  evidence: { signal: string; reading: string; interpretation: string; source: string }[];
  hypotheses: { name: string; status: "supported" | "rejected" | "open"; reason: string }[];
  action: { title: string; rationale: string; verification: string };
  caveat: string;
};

const investigations = [
  "Investigate the active premiere. Which audience is affected, what changed, and what reversible action should the operator take?",
  "Determine whether Mumbai's playback degradation is caused by origin latency, CDN throughput, or rendition-specific segment failures.",
  "Compare every venue over the last fifteen minutes. Is this a global outage or an isolated release problem?",
  "After the rollback, verify whether audience impact actually recovered. Which signals prove or contradict recovery?",
];

function formatClock(value: string) {
  return new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(value));
}

export function CommandCenter() {
  const [status, setStatus] = useState<Status>();
  const [busy, setBusy] = useState<"inject" | "recover" | "investigate" | "">("");
  const [error, setError] = useState("");
  const [report, setReport] = useState<Report>();
  const [calls, setCalls] = useState<Array<{ name: string; args: unknown; response?: unknown }>>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [query, setQuery] = useState(investigations[0]);
  const [statusError, setStatusError] = useState("");
  function chooseQuestion(index: number) { setQuestionIndex(index); setQuery(investigations[index]); }

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/status", { cache: "no-store" });
      if (!response.ok) throw new Error("Live telemetry is unavailable.");
      setStatus(await response.json());
      setStatusError("");
    } catch (caught) {
      setStatusError(caught instanceof Error ? caught.message : "Live telemetry is unavailable.");
    }
  }, []);

  useEffect(() => {
    const kickoff = window.setTimeout(refresh, 0);
    const interval = window.setInterval(refresh, 5_000);
    return () => { window.clearTimeout(kickoff); window.clearInterval(interval); };
  }, [refresh]);

  const totals = useMemo(() => {
    const venues = status?.venues ?? [];
    return {
      viewers: venues.reduce((sum, venue) => sum + venue.viewers, 0),
      impacted: venues.reduce((sum, venue) => sum + venue.impacted, 0),
      maxRebuffer: Math.max(0, ...venues.map((venue) => venue.rebufferRatio)),
    };
  }, [status]);

  async function control(action: "inject" | "recover") {
    setBusy(action); setError(""); setReport(undefined); setCalls([]);
    try {
      const response = await fetch("/api/control", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      if (!response.ok) throw new Error("The simulation control did not respond.");
      await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Control failed."); }
    finally { setBusy(""); }
  }

  async function investigate() {
    setBusy("investigate"); setError(""); setReport(undefined); setCalls([]);
    try {
      const response = await fetch("/api/investigate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "The incident agent did not complete its investigation.");
      setReport(payload.report); setCalls(payload.calls ?? []);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Investigation failed."); }
    finally { setBusy(""); }
  }

  const phase = status?.state.phase ?? "healthy";
  return <main className={styles.shell} data-phase={phase}>
    <header className={styles.topbar}>
      <div className={styles.identity}><span className={styles.wordmark}>Screening<br />Command Center</span><span className={styles.premiere}>The Last Broadcast<br />World premiere</span></div>
      <div className={styles.integration}>{statusError ? "Telemetry status unavailable" : !status ? "Checking Grafana delivery…" : status.delivery.metrics && status.delivery.logs ? "Grafana accepted metrics + logs" : "Grafana delivery incomplete"}<span>Simulated screening · real Grafana queries</span></div>
    </header>

    <section className={styles.masthead}>
      <div>
        <p>Tonight’s screening network</p>
        <h1>{phase === "healthy" ? "Every audience is watching." : phase === "incident" ? "Mumbai is losing the picture." : "Mumbai is returning to air."}</h1>
      </div>
      <div className={styles.clock}><span>Observed</span><strong>{status ? formatClock(status.observedAt) : "--:--:--"}</strong><small>IST · live telemetry</small></div>
    </section>

    <section className={styles.audienceStrip} aria-label="Audience impact summary">
      <div><span>Watching now</span><strong>{totals.viewers.toLocaleString()}</strong></div>
      <div className={totals.impacted ? styles.danger : ""}><span>Impacted viewers</span><strong>{totals.impacted.toLocaleString()}</strong></div>
      <div><span>Worst rebuffer ratio</span><strong>{(totals.maxRebuffer * 100).toFixed(1)}%</strong></div>
      <div><span>Edge release</span><strong>{status?.state.release.split(".").at(-1) ? `Release ${status.state.release.split(".").at(-1)}` : "—"}</strong></div>
    </section>

    <section className={styles.operationGrid}>
      <div className={styles.venues}>
        <div className={styles.sectionHeading}><h2>Venue signal</h2><span>{status?.venues.length ?? 0} reporting</span></div>
        {(status?.venues ?? []).map((venue) => <article className={styles.venue} data-state={venue.state} key={venue.id}>
          <div className={styles.venueName}><span className={styles.signalBar} /><div><strong>{venue.city}</strong><small>{venue.venue}</small></div><b>{venue.state}</b></div>
          <div className={styles.venueMeasure}><div><span>Audience</span><strong>{venue.viewers.toLocaleString()}</strong></div><div><span>Impacted</span><strong>{venue.impacted.toLocaleString()}</strong></div><div><span>Errors</span><strong>{(venue.errorRate * 100).toFixed(1)}%</strong></div><div><span>Rebuffer</span><strong>{(venue.rebufferRatio * 100).toFixed(1)}%</strong></div></div>
          <div className={styles.meter}><i style={{ width: `${Math.min(100, venue.errorRate * 380)}%` }} /></div>
        </article>)}
      </div>

      <aside className={styles.operator}>
        <div className={styles.sectionHeading}><h2>Operator controls</h2><span>Demonstration</span></div>
        <p>Simulate a screening fault and send its measurements to Grafana. Rollback changes the simulation; only a fresh investigation can assess recovery. Demo telemetry is generated while this page is open.</p>
        <button className={styles.inject} disabled={busy !== "" || phase === "incident"} onClick={() => control("inject")}><span>1</span><b>Inject 4K manifest fault</b><small>Publishes errors, impact and release labels</small></button>
        <button className={styles.investigate} disabled={busy !== "" || query.trim().length < 10} onClick={investigate}><span>2</span><b>{busy === "investigate" ? "Querying Grafana evidence…" : "Investigate with Gemini"}</b><small>Available before, during, and after an incident</small></button>
        <button className={styles.recover} disabled={busy !== "" || phase === "healthy"} onClick={() => control("recover")}><span>3</span><b>Roll back edge release</b><small>Watch the audience recover over 25 seconds</small></button>
        <a href={status?.grafanaUrl || "#"} target="_blank" rel="noreferrer">Open the evidence in Grafana</a>
      </aside>
    </section>

    <section className={styles.investigation}>
      <div className={styles.sectionHeading}><h2>Incident commander</h2><span>{report ? `${report.confidence} confidence` : "Awaiting investigation"}</span></div>
      <div className={styles.questionRow}>
        <button disabled={busy !== ""} onClick={() => chooseQuestion((questionIndex - 1 + investigations.length) % investigations.length)} aria-label="Previous investigation">←</button>
        <textarea aria-label="Investigation question" value={query} maxLength={600} rows={3} disabled={busy !== ""} onChange={(e) => setQuery(e.target.value)} />
        <button disabled={busy !== ""} onClick={() => chooseQuestion((questionIndex + 1) % investigations.length)} aria-label="Next investigation">→</button>
      </div>
      {(error || statusError) && <p className={styles.error}>{error || statusError}</p>}
      {!report && !error && <div className={styles.emptyReport}><span>{busy === "investigate" ? "Gemini is correlating metrics and logs through Grafana MCP." : "Inject a fault, then ask Gemini to establish audience impact and test competing causes."}</span>{calls.length > 0 && <b>{calls.length} Grafana tools called</b>}</div>}
      {report && <div className={styles.report}>
        <div className={styles.reportLead}><div><span data-severity={report.severity}>{report.severity}</span><h3>{report.headline}</h3><p>{report.diagnosis}</p></div><strong>{report.affected_audience}<small>Audience impact</small></strong></div>
        <div className={styles.evidence}>{report.evidence.map((item) => <article key={item.signal}><span>{item.source}</span><strong>{item.reading}</strong><p>{item.interpretation}</p></article>)}</div>
        <div className={styles.hypotheses}><h3>Competing causes tested</h3>{report.hypotheses.map((item) => <div key={item.name}><b data-status={item.status}>{item.status}</b><strong>{item.name}</strong><p>{item.reason}</p></div>)}</div>
        <div className={styles.action}><span>Recommended operator action</span><strong>{report.action.title}</strong><p>{report.action.rationale}</p><small>Verify: {report.action.verification}</small></div>
        <details className={styles.calls}><summary>{calls.length} Grafana MCP calls · inspect runtime evidence</summary>{calls.map((call, index) => <div key={`${call.name}-${index}`}><strong>{index + 1}. {call.name}</strong><p>Query arguments</p><pre>{JSON.stringify(call.args, null, 2)}</pre><p>Grafana response</p><pre>{call.response === undefined ? "No response captured" : JSON.stringify(call.response, null, 2)}</pre></div>)}</details>
        <p className={styles.caveat}>{report.caveat}</p>
      </div>}
    </section>

    <section className={styles.timeline}>
      <div className={styles.sectionHeading}><h2>Premiere timeline</h2><span>Newest first</span></div>
      {(status?.state.timeline ?? []).map((item) => <div key={item.id} data-kind={item.kind}><time>{formatClock(item.at)}</time><i /><strong>{item.title}</strong><p>{item.detail}</p></div>)}
    </section>
  </main>;
}
