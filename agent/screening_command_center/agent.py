import os
from pathlib import Path

from dotenv import load_dotenv
from google.adk.agents import Agent
from .resilient_model import ResilientGemini, model_chain
from google.adk.tools.mcp_tool.mcp_session_manager import StdioConnectionParams
from google.adk.tools.mcp_tool.mcp_toolset import McpToolset
from mcp import StdioServerParameters
from pydantic import BaseModel, Field


load_dotenv(Path(__file__).resolve().parents[2] / ".env.local")


class Evidence(BaseModel):
    signal: str
    reading: str
    interpretation: str
    source: str


class Hypothesis(BaseModel):
    name: str
    status: str = Field(pattern="^(supported|rejected|open)$")
    reason: str


class Action(BaseModel):
    title: str
    rationale: str
    verification: str


class IncidentReport(BaseModel):
    headline: str
    severity: str = Field(pattern="^(critical|major|minor|healthy)$")
    affected_audience: str
    diagnosis: str
    confidence: str = Field(pattern="^(high|medium|low)$")
    evidence: list[Evidence]
    hypotheses: list[Hypothesis]
    action: Action
    caveat: str


def grafana_tools() -> McpToolset:
    executable = os.getenv(
        "MCP_GRAFANA_EXECUTABLE",
        str(Path(__file__).resolve().parents[2] / ".mcp-venv" / "bin" / "mcp-grafana"),
    )
    env = {
        **os.environ,
        "GRAFANA_URL": os.environ["GRAFANA_URL"],
        "GRAFANA_SERVICE_ACCOUNT_TOKEN": os.environ["GRAFANA_SERVICE_ACCOUNT_TOKEN"],
    }
    # These credentials belong to the screening simulator. The MCP server is an
    # evidence reader and should not try to export its own telemetry with them.
    env.pop("OTEL_EXPORTER_OTLP_ENDPOINT", None)
    env.pop("OTEL_EXPORTER_OTLP_HEADERS", None)
    return McpToolset(
        connection_params=StdioConnectionParams(
            server_params=StdioServerParameters(command=executable, args=["-transport", "stdio", "-disable-write"], env=env),
            timeout=45,
        )
    )


def bound_tool_calls(tool, args, tool_context):
    used = int(tool_context.state.get("grafana_calls", 0))
    if used >= 10:
        return {"error": "Grafana MCP call budget exhausted. Produce the incident report from evidence already collected."}
    tool_context.state["grafana_calls"] = used + 1
    return None


root_agent = Agent(
    name="screening_command_center_agent",
    model=ResilientGemini(model=model_chain()[0]),
    description="Investigates live audience-impacting screening incidents using Grafana evidence.",
    instruction="""
You are the incident commander for a live international film premiere. The only
factual source for current operational claims is Grafana, accessed through its MCP
tools at runtime. Never diagnose from the user's wording alone.

For every investigation:
1. Locate the Prometheus and Loki data sources with Grafana MCP.
2. Query the last fifteen minutes of screening_* metrics. Establish total and
   affected viewers by venue before discussing infrastructure.
3. Query screening playback logs for the affected venue, rendition, error code,
   and deployment marker. Retrieve only a bounded interval.
4. Form at least three competing explanations. Use metrics and logs to support or
   reject each one; leave insufficiently tested explanations open.
5. Recommend one reversible operator action. Explain which exact signal should
   recover if it works. Do not claim that an action was performed unless Grafana
   evidence observed after the action proves it.
6. Distinguish correlation from causation and expose missing evidence.

Known metric names include screening_active_viewers, screening_impacted_viewers,
screening_rebuffer_ratio, screening_segment_error_rate, screening_startup_seconds,
screening_origin_latency_ms, and screening_cdn_throughput_mbps. Useful labels include
venue, city, screening, rendition, cdn, release, and scenario. Logs use service_name
screening-gateway and contain event, venue, rendition, status, error_code, trace_id,
and release fields.

Return the structured report only. Use 3-5 evidence items and exactly 3 competing
hypotheses. Source labels must name the Grafana signal and query type, for example
"Prometheus · screening_rebuffer_ratio" or "Loki · playback_segment_error".
""",
    tools=[grafana_tools()],
    output_schema=IncidentReport,
    before_tool_callback=bound_tool_calls,
)
