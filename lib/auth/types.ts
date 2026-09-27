export const WORKSPACE_ROLES = ["owner", "admin", "member", "viewer"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const SESSION_MODES = ["user", "demo"] as const;
export type SessionMode = (typeof SESSION_MODES)[number];

export const ONBOARDING_STEPS = [
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
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export type UserRecord = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkspaceRecord = {
  id: string;
  name: string;
  slug: string;
  kind: "user" | "demo";
  industry: string;
  team_size: string;
  country: string;
  currency: string;
  timezone: string;
  logo: string;
  agent_name: string;
  interaction_density: string;
  notification_preference: string;
  owner_id: string;
  onboarding_step: OnboardingStep;
  onboarding_completed_at: string | null;
  protections: string;
  created_at: string;
  updated_at: string;
};

export type MembershipRecord = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
};

export type SessionRecord = {
  id: string;
  user_id: string | null;
  token_hash: string;
  workspace_id: string | null;
  mode: SessionMode;
  expires_at: string;
  created_at: string;
};

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
};

export type PublicWorkspace = {
  id: string;
  name: string;
  kind: "user" | "demo";
  industry: string;
  teamSize: string;
  country: string;
  currency: string;
  timezone: string;
  logo: string;
  agentName: string;
  interactionDensity: string;
  notificationPreference: string;
  onboardingStep: OnboardingStep;
  onboardingCompleted: boolean;
  protections: string[];
};

export type AuthSession = {
  id: string;
  token: string;
  user: PublicUser | null;
  workspace: PublicWorkspace | null;
  role: WorkspaceRole | "operator" | null;
  mode: SessionMode;
  expiresAt: string;
};

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Denied") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export const SESSION_COOKIE = "ep_session";
export const SESSION_DAYS = 14;
