/**
 * The human-only HTTP routes the mobile surface (and any future Expo client) calls.
 * These are the SAME routes the desktop plan page uses (components/ApproveActionButton.tsx).
 * Mobile never calls the agent approval tool and never has its own approval endpoint.
 */
export const HUMAN_ROUTES = {
  approveAction: (planId: string, actionId: string) =>
    `/api/plans/${encodeURIComponent(planId)}/actions/${encodeURIComponent(actionId)}/approve`,
  executeAction: (actionId: string) => `/api/actions/${encodeURIComponent(actionId)}/execute`,
  rejectDecision: (decisionId: string) => `/api/autopilot/decisions/${encodeURIComponent(decisionId)}/reject`,
  ask: () => "/api/ask",
  pulse: () => "/api/pulse",
  health: () => "/api/health",
} as const;

/** Attention ids contain ':' (e.g. `exception:exc_proposal_missed`); keep them URL-safe for /m/s/[id]. */
export function mobileSituationHref(attentionId: string): string {
  return `/m/s/${encodeURIComponent(attentionId)}`;
}
