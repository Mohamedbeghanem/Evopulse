/** Hero counts are a pure projection of pulseSummary().attention.summary — never hardcoded. */
export type AttentionSummaryCounts = {
  needsYou: number;
  needsApproval: number;
  monitoring: number;
  handled: number;
  autoHandled: number;
};

export function pulseCounts(summary: AttentionSummaryCounts) {
  return {
    needsYou: summary.needsYou + summary.needsApproval,
    monitoring: summary.monitoring,
    handled: summary.handled + summary.autoHandled,
  };
}
