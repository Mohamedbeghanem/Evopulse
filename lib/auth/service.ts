import { id } from "../ids";
import { forgetWorkspaceDb, openWorkspaceDb } from "../workspace/db";
import { getControlDb } from "./control-db";
import { hashPassword, hashToken, normalizeEmail, randomToken, verifyPassword } from "./crypto";
import {
  AuthError,
  ForbiddenError,
  SESSION_DAYS,
  UnauthorizedError,
  type AuthSession,
  type MembershipRecord,
  type OnboardingStep,
  type PublicUser,
  type PublicWorkspace,
  type SessionMode,
  type UserRecord,
  type WorkspaceRecord,
  type WorkspaceRole,
} from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function nowIso() {
  return new Date().toISOString();
}

function plusDays(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString();
}

function plusHours(hours: number) {
  return new Date(Date.now() + hours * 3600000).toISOString();
}

function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: Boolean(user.email_verified_at),
  };
}

function parseProtections(raw: string): string[] {
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function toPublicWorkspace(row: WorkspaceRecord): PublicWorkspace {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    industry: row.industry,
    teamSize: row.team_size,
    country: row.country,
    currency: row.currency,
    timezone: row.timezone,
    logo: row.logo,
    agentName: row.agent_name,
    interactionDensity: row.interaction_density,
    notificationPreference: row.notification_preference,
    onboardingStep: row.onboarding_step,
    onboardingCompleted: Boolean(row.onboarding_completed_at),
    protections: parseProtections(row.protections),
  };
}

function getUserByEmail(email: string): UserRecord | undefined {
  return getControlDb().prepare("SELECT * FROM users WHERE email = ?").get(normalizeEmail(email)) as UserRecord | undefined;
}

function getUserById(userId: string): UserRecord | undefined {
  return getControlDb().prepare("SELECT * FROM users WHERE id = ?").get(userId) as UserRecord | undefined;
}

export function getWorkspace(workspaceId: string): WorkspaceRecord | undefined {
  return getControlDb().prepare("SELECT * FROM workspaces WHERE id = ?").get(workspaceId) as WorkspaceRecord | undefined;
}

export function getMembership(userId: string, workspaceId: string): MembershipRecord | undefined {
  return getControlDb()
    .prepare("SELECT * FROM memberships WHERE user_id = ? AND workspace_id = ?")
    .get(userId, workspaceId) as MembershipRecord | undefined;
}

export function listMemberships(workspaceId: string): Array<MembershipRecord & { email: string; name: string }> {
  return getControlDb()
    .prepare(
      `SELECT m.*, u.email, u.name
       FROM memberships m JOIN users u ON u.id = m.user_id
       WHERE m.workspace_id = ?
       ORDER BY m.created_at`,
    )
    .all(workspaceId) as Array<MembershipRecord & { email: string; name: string }>;
}

export function assertWorkspaceAccess(userId: string, workspaceId: string): MembershipRecord {
  const membership = getMembership(userId, workspaceId);
  if (!membership) throw new ForbiddenError("You cannot access that workspace.");
  return membership;
}

function canWrite(role: WorkspaceRole) {
  return role === "owner" || role === "admin" || role === "member";
}

function canAdmin(role: WorkspaceRole) {
  return role === "owner" || role === "admin";
}

export function assertCanWrite(role: WorkspaceRole) {
  if (!canWrite(role)) throw new ForbiddenError("Viewers cannot change this workspace.");
}

export function assertCanAdmin(role: WorkspaceRole) {
  if (!canAdmin(role)) throw new ForbiddenError("Only owners and admins can do that.");
}

function createSession(input: {
  userId?: string | null;
  workspaceId?: string | null;
  mode: SessionMode;
}): { recordId: string; token: string; expiresAt: string } {
  const token = randomToken();
  const recordId = id("ses");
  const expiresAt = plusDays(SESSION_DAYS);
  getControlDb()
    .prepare(
      `INSERT INTO sessions (id, user_id, token_hash, workspace_id, mode, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(recordId, input.userId ?? null, hashToken(token), input.workspaceId ?? null, input.mode, expiresAt, nowIso());
  return { recordId, token, expiresAt };
}

function sessionFromToken(token: string): AuthSession | null {
  if (!token) return null;
  const row = getControlDb()
    .prepare("SELECT * FROM sessions WHERE token_hash = ?")
    .get(hashToken(token)) as
    | {
        id: string;
        user_id: string | null;
        workspace_id: string | null;
        mode: SessionMode;
        expires_at: string;
      }
    | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    getControlDb().prepare("DELETE FROM sessions WHERE id = ?").run(row.id);
    return null;
  }
  const user = row.user_id ? getUserById(row.user_id) : undefined;
  const workspace = row.workspace_id ? getWorkspace(row.workspace_id) : undefined;
  const membership = user && workspace ? getMembership(user.id, workspace.id) : undefined;
  return {
    id: row.id,
    token,
    user: user ? toPublicUser(user) : null,
    workspace: workspace ? toPublicWorkspace(workspace) : null,
    role: membership?.role ?? (row.mode === "demo" ? "operator" : null),
    mode: row.mode,
    expiresAt: row.expires_at,
  };
}

export const AuthService = {
  signup(input: { email: string; password: string; name: string }) {
    const email = normalizeEmail(input.email);
    const name = input.name.trim();
    if (!EMAIL_RE.test(email)) throw new AuthError("Enter a valid email.");
    if (input.password.length < 8) throw new AuthError("Password must be at least 8 characters.");
    if (!name) throw new AuthError("Enter your name.");
    if (getUserByEmail(email)) throw new AuthError("An account with that email already exists.", 409);

    const userId = id("usr");
    const workspaceId = id("ws");
    const ts = nowIso();
    const db = getControlDb();
    db.exec("BEGIN");
    try {
      db.prepare(
        `INSERT INTO users (id, email, name, password_hash, email_verified_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?)`,
      ).run(userId, email, name, hashPassword(input.password), ts, ts);
      db.prepare(
        `INSERT INTO workspaces (
           id, name, slug, kind, industry, team_size, country, currency, timezone, logo,
           agent_name, interaction_density, notification_preference, owner_id, onboarding_step,
           onboarding_completed_at, protections, created_at, updated_at
         ) VALUES (?, ?, ?, 'user', '', '', '', 'USD', 'UTC', '', 'Pulse', 'balanced', 'needs_you', ?, 'welcome', NULL, '[]', ?, ?)`,
      ).run(workspaceId, `${name}'s business`, workspaceId, userId, ts, ts);
      db.prepare(`INSERT INTO memberships (id, workspace_id, user_id, role, created_at) VALUES (?, ?, ?, 'owner', ?)`).run(
        id("mem"),
        workspaceId,
        userId,
        ts,
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }

    openWorkspaceDb(workspaceId);
    const verifyToken = issueToken(userId, "verify", 24 * 7);
    const session = createSession({ userId, workspaceId, mode: "user" });
    return {
      user: toPublicUser(getUserById(userId)!),
      workspace: toPublicWorkspace(getWorkspace(workspaceId)!),
      session,
      verifyToken,
    };
  },

  login(input: { email: string; password: string }) {
    const user = getUserByEmail(input.email);
    if (!user || !verifyPassword(input.password, user.password_hash)) {
      throw new AuthError("Email or password is incorrect.", 401);
    }
    const membership = getControlDb()
      .prepare("SELECT * FROM memberships WHERE user_id = ? ORDER BY created_at LIMIT 1")
      .get(user.id) as MembershipRecord | undefined;
    const session = createSession({
      userId: user.id,
      workspaceId: membership?.workspace_id ?? null,
      mode: "user",
    });
    return {
      user: toPublicUser(user),
      workspace: membership ? toPublicWorkspace(getWorkspace(membership.workspace_id)!) : null,
      session,
    };
  },

  logout(token: string) {
    if (!token) return;
    getControlDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
  },

  sessionFromToken,

  requireSession(token?: string | null): AuthSession {
    const session = token ? sessionFromToken(token) : null;
    if (!session?.user) throw new UnauthorizedError();
    return session;
  },

  switchWorkspace(token: string, workspaceId: string) {
    const session = this.requireSession(token);
    if (workspaceId === "ws_demo") {
      getControlDb()
        .prepare("UPDATE sessions SET workspace_id = NULL, mode = 'demo' WHERE id = ?")
        .run(session.id);
      return sessionFromToken(token)!;
    }
    assertWorkspaceAccess(session.user!.id, workspaceId);
    getControlDb()
      .prepare("UPDATE sessions SET workspace_id = ?, mode = 'user' WHERE id = ?")
      .run(workspaceId, session.id);
    return sessionFromToken(token)!;
  },

  enterDemo(token?: string | null) {
    if (token) {
      const session = sessionFromToken(token);
      if (session) {
        getControlDb().prepare("UPDATE sessions SET mode = 'demo' WHERE id = ?").run(session.id);
        return sessionFromToken(token);
      }
    }
    const created = createSession({ mode: "demo" });
    return sessionFromToken(created.token);
  },

  requestPasswordReset(email: string) {
    const user = getUserByEmail(email);
    if (!user) return { resetToken: null as string | null };
    const resetToken = issueToken(user.id, "reset", 1);
    return { resetToken };
  },

  resetPassword(token: string, password: string) {
    if (password.length < 8) throw new AuthError("Password must be at least 8 characters.");
    const userId = consumeToken(token, "reset");
    getControlDb()
      .prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?")
      .run(hashPassword(password), nowIso(), userId);
    getControlDb().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
    return { userId };
  },

  verifyEmail(token: string) {
    const userId = consumeToken(token, "verify");
    getControlDb()
      .prepare("UPDATE users SET email_verified_at = ?, updated_at = ? WHERE id = ? AND email_verified_at IS NULL")
      .run(nowIso(), nowIso(), userId);
    return { userId };
  },

  updateProfile(userId: string, input: { name?: string }) {
    const name = input.name?.trim();
    if (name) {
      getControlDb().prepare("UPDATE users SET name = ?, updated_at = ? WHERE id = ?").run(name, nowIso(), userId);
    }
    return toPublicUser(getUserById(userId)!);
  },

  updateWorkspace(
    workspaceId: string,
    patch: Partial<{
      name: string;
      industry: string;
      team_size: string;
      country: string;
      currency: string;
      timezone: string;
      logo: string;
      agent_name: string;
      interaction_density: string;
      notification_preference: string;
      onboarding_step: OnboardingStep;
      protections: string[];
    }>,
  ) {
    const current = getWorkspace(workspaceId);
    if (!current) throw new AuthError("Workspace not found.", 404);
    const next: WorkspaceRecord = {
      ...current,
      name: patch.name?.trim() || current.name,
      industry: patch.industry ?? current.industry,
      team_size: patch.team_size ?? current.team_size,
      country: patch.country ?? current.country,
      currency: patch.currency ?? current.currency,
      timezone: patch.timezone ?? current.timezone,
      logo: patch.logo ?? current.logo,
      agent_name: patch.agent_name?.trim() || current.agent_name,
      interaction_density: patch.interaction_density ?? current.interaction_density,
      notification_preference: patch.notification_preference ?? current.notification_preference,
      onboarding_step: patch.onboarding_step ?? current.onboarding_step,
      protections: patch.protections ? JSON.stringify(patch.protections) : current.protections,
      updated_at: nowIso(),
    };
    getControlDb()
      .prepare(
        `UPDATE workspaces SET
          name=?, industry=?, team_size=?, country=?, currency=?, timezone=?, logo=?,
          agent_name=?, interaction_density=?, notification_preference=?, onboarding_step=?,
          protections=?, updated_at=?
         WHERE id=?`,
      )
      .run(
        next.name,
        next.industry,
        next.team_size,
        next.country,
        next.currency,
        next.timezone,
        next.logo,
        next.agent_name,
        next.interaction_density,
        next.notification_preference,
        next.onboarding_step,
        next.protections,
        next.updated_at,
        workspaceId,
      );
    return toPublicWorkspace(getWorkspace(workspaceId)!);
  },

  completeOnboarding(workspaceId: string) {
    getControlDb()
      .prepare(
        "UPDATE workspaces SET onboarding_step = 'complete', onboarding_completed_at = ?, updated_at = ? WHERE id = ?",
      )
      .run(nowIso(), nowIso(), workspaceId);
    return toPublicWorkspace(getWorkspace(workspaceId)!);
  },

  addMember(workspaceId: string, actorRole: WorkspaceRole, email: string, role: WorkspaceRole) {
    assertCanAdmin(actorRole);
    if (role === "owner") throw new AuthError("Use transfer ownership instead.");
    const user = getUserByEmail(email);
    if (!user) throw new AuthError("That person does not have an EvoPulse account yet.");
    if (getMembership(user.id, workspaceId)) throw new AuthError("They are already in this workspace.", 409);
    getControlDb()
      .prepare("INSERT INTO memberships (id, workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(id("mem"), workspaceId, user.id, role, nowIso());
    return listMemberships(workspaceId);
  },

  updateMemberRole(workspaceId: string, actorRole: WorkspaceRole, memberUserId: string, role: WorkspaceRole) {
    assertCanAdmin(actorRole);
    const workspace = getWorkspace(workspaceId);
    if (!workspace) throw new AuthError("Workspace not found.", 404);
    if (memberUserId === workspace.owner_id) throw new AuthError("The owner role cannot be changed here.");
    if (role === "owner") throw new AuthError("The owner role cannot be assigned this way.");
    getControlDb()
      .prepare("UPDATE memberships SET role = ? WHERE workspace_id = ? AND user_id = ?")
      .run(role, workspaceId, memberUserId);
    return listMemberships(workspaceId);
  },

  destroyUserWorkspaceFiles(workspaceId: string) {
    forgetWorkspaceDb(workspaceId);
  },
};

function issueToken(userId: string, type: "verify" | "reset", hours: number): string {
  const token = randomToken();
  getControlDb()
    .prepare(
      `INSERT INTO auth_tokens (id, user_id, type, token_hash, expires_at, used_at)
       VALUES (?, ?, ?, ?, ?, NULL)`,
    )
    .run(id("tok"), userId, type, hashToken(token), plusHours(hours));
  return token;
}

function consumeToken(token: string, type: "verify" | "reset"): string {
  const row = getControlDb()
    .prepare("SELECT * FROM auth_tokens WHERE token_hash = ? AND type = ?")
    .get(hashToken(token), type) as
    | { id: string; user_id: string; expires_at: string; used_at: string | null }
    | undefined;
  if (!row || row.used_at) throw new AuthError("This link is invalid or already used.", 400);
  if (new Date(row.expires_at).getTime() < Date.now()) throw new AuthError("This link has expired.", 400);
  getControlDb().prepare("UPDATE auth_tokens SET used_at = ? WHERE id = ?").run(nowIso(), row.id);
  return row.user_id;
}
