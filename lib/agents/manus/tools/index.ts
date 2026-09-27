import type { DatabaseSync } from "node:sqlite";
import type { ManusTool } from "../tool";
import { ToolCollection } from "../tool-collection";
import { askHumanTool, terminateTool } from "./control";
import { evopulseCoreTools, evopulsePluginTools } from "./evopulse";
import { unavailableTools } from "./unavailable";
import { webSearchTool } from "./web-search";

export { ASK_HUMAN, TERMINATE, askHumanTool, terminateTool } from "./control";
export { evopulseCoreTools, evopulsePluginTools, MANUS_EXCLUDED_CORE_TOOLS, toManusOutcome } from "./evopulse";
export { formatPlan, PLAN_STEP_STATUSES, PLANNING, PlanningTool, STEP_MARK, type Plan, type PlanStepStatus } from "./planning";
export { isServerless, unavailableTools } from "./unavailable";
export { WEB_SEARCH, webSearchConfig, webSearchTool } from "./web-search";

/**
 * The Manus agent's ToolCollection (OpenManus Manus.available_tools + MCP tools):
 * control tools, EvoPulse core tools, enabled plugin / MCP tools, web search (only when configured),
 * and honest "not available" stubs for OpenManus' code / shell / file / browser tools.
 */
export function buildManusToolCollection(
  db: DatabaseSync,
  options: { env?: NodeJS.ProcessEnv; extraTools?: ManusTool[] } = {},
): ToolCollection {
  const env = options.env || process.env;
  return new ToolCollection(
    terminateTool(),
    askHumanTool(),
    ...evopulseCoreTools(),
    ...evopulsePluginTools(db),
    webSearchTool(env),
    ...unavailableTools(env),
    ...(options.extraTools || []),
  );
}
