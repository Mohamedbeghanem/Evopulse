import type { CommandResult } from "../command/types";
import { id } from "../ids";
import type { AgentRun } from "./types";

export function toAskResponse(run: AgentRun, message: string) {
  const command = projectCommand(run, message);
  return {
    ...command,
    question: message,
    answer: run.summary || command.summary,
    grounded: run.report.intent !== "UNKNOWN",
    agent: {
      runId: run.id,
      sessionId: run.sessionId,
      status: run.status,
      phase: run.phase,
      runtime: run.runtime,
      fallbackUsed: run.fallbackUsed,
      summary: run.summary,
      report: run.report,
      steps: run.steps,
      toolCalls: run.toolCalls.map((call) => ({
        id: call.id,
        tool: call.tool,
        permission: call.permission,
        status: call.status,
        arguments: call.arguments,
        result: call.result,
        durationMs: call.durationMs,
      })),
      approvals: run.approvals,
    },
  };
}

function projectCommand(run: AgentRun, message: string): CommandResult {
  const explain = data(run, "explain_risk");
  const sim = data(run, "simulate_change");
  const attention = data(run, "get_attention") || data(run, "get_business_state");
  const plan = data(run, "evaluate_plan") || data(run, "generate_plan");
  const exec = data(run, "execute_safe_actions");
  const policy = data(run, "get_policy") || data(run, "get_safe_actions");
  const verify = data(run, "get_verification");
  const intent = run.report.intent || "UNKNOWN";
  return {
    commandId: run.id || id("cmd"),
    intent,
    understoodAs: message,
    answerType:
      intent === "CAUSAL_EXPLANATION"
        ? "CAUSAL_PATH"
        : intent === "SIMULATION"
          ? "SIMULATION"
          : intent === "GOAL" || intent === "PLAN"
            ? "PLAN"
            : intent === "EXECUTION"
              ? "EXECUTION_RESULT"
              : intent === "POLICY"
                ? "POLICY"
                : intent === "FUTURE_RISK"
                  ? "WARNING"
                  : intent === "ATTENTION"
                    ? "ATTENTION"
                    : intent === "BUSINESS_CHANGES"
                      ? "TIMELINE"
                      : "SUMMARY",
    status:
      run.status === "waiting_for_approval"
        ? "APPROVAL_REQUIRED"
        : run.status === "failed"
          ? "FAILED"
          : run.report.policyBlocked
            ? "BLOCKED"
            : run.report.executed
              ? "EXECUTED"
              : "OK",
    summary: run.summary || message,
    data: {
      ...(explain || {}),
      ...(sim || {}),
      ...(attention || {}),
      ...(plan || {}),
      ...(exec || {}),
      ...(policy || {}),
      ...(verify || {}),
      allowedAlternative: run.report.allowedAlternative,
    },
    evidence: run.toolCalls.flatMap((call) => call.result.evidence).slice(0, 12),
    actions: [],
    links: run.toolCalls.flatMap((call) => call.result.links).slice(0, 6),
    sourceSystems: [...new Set(run.toolCalls.flatMap((call) => call.result.evidence.map((item) => item.sourceSystem)))],
    generatedAt: run.finishedAt || run.startedAt,
    assumptions: [],
    warnings: run.error ? [run.error] : [],
    approvalRequired: run.status === "waiting_for_approval",
    session: { id: run.sessionId, lastIntent: intent },
  };
}

function data(run: AgentRun, tool: string) {
  return run.toolCalls.find((call) => call.tool === tool)?.result.data;
}
