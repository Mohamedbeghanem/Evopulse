export { getControlDb, resetControlDbHandle } from "./control-db";
export { hashPassword, hashToken, normalizeEmail, randomToken, verifyPassword } from "./crypto";
export {
  authErrorResponse,
  clearSessionCookie,
  readSessionToken,
  requireUserContext,
  resolveRequestContext,
  sessionCookieOptions,
  setSessionCookie,
  withUserWorkspace,
  withWorkspace,
} from "./http";
export {
  AuthService,
  assertCanAdmin,
  assertCanWrite,
  assertWorkspaceAccess,
  getMembership,
  getWorkspace,
  listMemberships,
  toPublicWorkspace,
} from "./service";
export {
  AuthError,
  ForbiddenError,
  ONBOARDING_STEPS,
  SESSION_COOKIE,
  SESSION_DAYS,
  UnauthorizedError,
  WORKSPACE_ROLES,
  type AuthSession,
  type OnboardingStep,
  type PublicUser,
  type PublicWorkspace,
  type SessionMode,
  type WorkspaceRole,
} from "./types";

export type { RequestContext } from "./http";
