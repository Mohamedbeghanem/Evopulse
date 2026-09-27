export { classifySituation } from "./classify";
export { ExceptionAutopilotService } from "./service";
export { ensureAutopilotHooks, handleAutopilotEvent, releaseAutopilotHooks } from "./hooks";
export { migrateAutopilotTables, wipeAutopilotTables } from "./schema";
export { AUTOPILOT_REASON_CODES, AUTOPILOT_STATES, AUTOPILOT_THRESHOLDS } from "./types";
export type {
  AutopilotCard,
  AutopilotDecisionRow,
  AutopilotReasonCode,
  AutopilotState,
  AutopilotSummary,
  AutopilotTrace,
} from "./types";
