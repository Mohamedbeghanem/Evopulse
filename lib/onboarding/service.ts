import { createGoal } from "../goals/service";
import { AuthError, AuthService, getWorkspace, type OnboardingStep, type PublicWorkspace } from "../auth";
import { DiscoveryService } from "../discovery/service";
import { IntegrationService } from "../integrations/service";
import type { DatabaseSync } from "node:sqlite";
import { PROTECTION_OPTIONS } from "./types";

export { PROTECTION_OPTIONS } from "./types";

const ORDER: OnboardingStep[] = [
  "welcome",
  "business",
  "protect",
  "meet",
  "connect",
  "discovery",
  "review",
  "goal",
  "first-pulse",
  "complete",
];

const GOAL_BY_PROTECTION: Record<string, { goalType: "protect_revenue" | "protect_cash" | "protect_customer_commitments" | "protect_business"; utterance: string }> =
  {
    revenue: { goalType: "protect_revenue", utterance: "Protect this month's revenue." },
    cash: { goalType: "protect_cash", utterance: "Protect this month's cash." },
    customers: { goalType: "protect_customer_commitments", utterance: "Protect customer commitments." },
    commitments: { goalType: "protect_customer_commitments", utterance: "Protect customer commitments." },
    orders: { goalType: "protect_business", utterance: "Protect everything at risk this week." },
    operations: { goalType: "protect_business", utterance: "Protect everything at risk this week." },
  };

export const OnboardingService = {
  nextPath(step: OnboardingStep) {
    const map: Record<OnboardingStep, string> = {
      welcome: "/onboarding",
      business: "/onboarding/business",
      protect: "/onboarding/protect",
      meet: "/onboarding/meet",
      connect: "/onboarding/connect",
      discovery: "/onboarding/discovery",
      review: "/onboarding/review",
      goal: "/onboarding/goal",
      "first-pulse": "/onboarding/first-pulse",
      complete: "/pulse",
    };
    return map[step];
  },

  advance(workspace: PublicWorkspace, to: OnboardingStep) {
    const currentIndex = ORDER.indexOf(workspace.onboardingStep);
    const nextIndex = ORDER.indexOf(to);
    if (nextIndex < currentIndex && to !== "complete") {
      return AuthService.updateWorkspace(workspace.id, { onboarding_step: to });
    }
    return AuthService.updateWorkspace(workspace.id, { onboarding_step: to });
  },

  saveBusiness(
    workspaceId: string,
    input: { name: string; industry: string; teamSize: string; country: string; currency: string },
  ) {
    if (!input.name.trim()) throw new AuthError("Give your business a name.");
    return AuthService.updateWorkspace(workspaceId, {
      name: input.name,
      industry: input.industry,
      team_size: input.teamSize,
      country: input.country,
      currency: input.currency || "USD",
      onboarding_step: "protect",
    });
  },

  saveProtections(workspaceId: string, protections: string[]) {
    const allowed = new Set<string>(PROTECTION_OPTIONS.map((item) => item.id));
    const next = protections.filter((item) => allowed.has(item));
    if (!next.length) throw new AuthError("Pick at least one thing for Pulse to protect.");
    return AuthService.updateWorkspace(workspaceId, { protections: next, onboarding_step: "meet" });
  },

  runDiscovery(workspaceId: string, db: DatabaseSync) {
    const workspace = getWorkspace(workspaceId);
    if (!workspace) throw new AuthError("Workspace not found.", 404);
    const facts = DiscoveryService.discover(workspaceId, db, AuthService.updateWorkspace(workspaceId, {}));
    AuthService.updateWorkspace(workspaceId, { onboarding_step: "review" });
    return facts;
  },

  setFirstGoal(workspaceId: string, db: DatabaseSync, protection: string) {
    const spec = GOAL_BY_PROTECTION[protection] || GOAL_BY_PROTECTION.operations;
    const created = createGoal(
      db,
      { goalType: spec.goalType, utterance: spec.utterance, source: "onboarding" },
      new Date().toISOString(),
      { plan: false },
    );
    AuthService.updateWorkspace(workspaceId, { onboarding_step: "first-pulse" });
    return created.goal;
  },

  firstPulse(workspaceId: string) {
    const workspace = AuthService.updateWorkspace(workspaceId, {});
    const facts = DiscoveryService.list(workspaceId);
    const connections = IntegrationService.list(workspaceId).filter((item) => item.connected);
    const observed = facts.filter((fact) => fact.count > 0);
    return {
      workspace,
      connections: connections.length,
      facts,
      needsYou: 0,
      monitoring: workspace.protections.length,
      opportunity: connections.length ? 1 : 0,
      empty: observed.length === 0,
    };
  },

  finish(workspaceId: string) {
    return AuthService.completeOnboarding(workspaceId);
  },
};
