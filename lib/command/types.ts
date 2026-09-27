export const COMMAND_INTENTS = [
  "BUSINESS_CHANGES",
  "ATTENTION",
  "FUTURE_RISK",
  "CAUSAL_EXPLANATION",
  "IMPACT",
  "SIMULATION",
  "GOAL",
  "PLAN",
  "HISTORY",
  "POLICY",
  "AUTOPILOT",
  "EXECUTION",
  "STATUS",
  "UNKNOWN",
] as const;

export type CommandIntent = (typeof COMMAND_INTENTS)[number];

export const SOURCE_SYSTEMS = [
  "EVENTS",
  "GRAPH",
  "EXPECTATIONS",
  "DETECT",
  "IMPACT",
  "EARLY_WARNING",
  "SIMULATION",
  "GOALS",
  "PLANNER",
  "POLICY",
  "AUTOPILOT",
  "VERIFICATION",
  "OUTCOME",
  "LEARNING",
] as const;

export type SourceSystem = (typeof SOURCE_SYSTEMS)[number];

export const ANSWER_TYPES = [
  "SUMMARY",
  "TIMELINE",
  "ATTENTION",
  "WARNING",
  "IMPACT",
  "CAUSAL_PATH",
  "SIMULATION",
  "PLAN",
  "POLICY",
  "EXECUTION_RESULT",
  "AUDIT_TRACE",
  "HISTORICAL_EVIDENCE",
] as const;

export type AnswerType = (typeof ANSWER_TYPES)[number];

export const TIME_SCOPES = ["today", "tomorrow", "this_week", "this_month", "next_24_hours", "unspecified"] as const;
export type TimeScope = (typeof TIME_SCOPES)[number];

export const RESULT_STATUSES = [
  "OK",
  "EXECUTED",
  "PREPARED",
  "APPROVAL_REQUIRED",
  "BLOCKED",
  "FAILED",
  "MONITORING",
] as const;

export type ResultStatus = (typeof RESULT_STATUSES)[number];

export type CommandEvidence = {
  statement: string;
  sourceSystem: SourceSystem;
  sourceType?: string;
  sourceId?: string;
  timestamp?: string;
};

export type CommandLink = {
  href: string;
  label: string;
};

export type CommandAction = {
  id: string;
  label: string;
  status: ResultStatus;
  href?: string;
};

export type CommandResult = {
  commandId: string;
  intent: CommandIntent;
  understoodAs: string;
  answerType: AnswerType;
  status: ResultStatus;
  summary: string;
  data: Record<string, unknown>;
  evidence: CommandEvidence[];
  actions: CommandAction[];
  links: CommandLink[];
  sourceSystems: SourceSystem[];
  generatedAt: string;
  assumptions: string[];
  warnings: string[];
  approvalRequired: boolean;
  session: { id: string; lastIntent: CommandIntent };
};

export type ScenarioParameters = {
  targetId: string;
  days: number;
};
