import type { DatabaseSync } from "node:sqlite";
import { projectAttention } from "../attention";
import { getMeta } from "../db";
import { pulseCounts } from "../ui/pulse-counts";
import { agentRoster } from "./agents";
import { businessOverview } from "./overview";

export { agentRoster, AGENT_NAMES, AGENT_SCOPES, type AgentCard, type AgentId } from "./agents";
export { businessOverview, type BusinessOverview, type BusinessRow } from "./overview";

/** Read-only snapshot: business rows + attention counts + derived agent activity. No writes. */
export function businessSnapshot(db: DatabaseSync) {
  const overview = businessOverview(db);
  const attention = projectAttention(db, getMeta(db, "demo_now"));
  const counts = pulseCounts(attention.summary);
  return {
    overview,
    pulse: counts,
    agents: agentRoster(db, counts, overview),
  };
}
