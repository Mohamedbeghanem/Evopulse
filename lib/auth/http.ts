import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { DatabaseSync } from "node:sqlite";
import { getDb, runWithDb } from "../db";
import { openWorkspaceDb } from "../workspace/db";
import { AuthService, getMembership, getWorkspace } from "./service";
import {
  AuthError,
  ForbiddenError,
  SESSION_COOKIE,
  SESSION_DAYS,
  UnauthorizedError,
  type AuthSession,
  type PublicUser,
  type PublicWorkspace,
  type SessionMode,
  type WorkspaceRole,
} from "./types";

export type RequestContext = {
  session: AuthSession | null;
  user: PublicUser | null;
  workspace: PublicWorkspace | null;
  role: WorkspaceRole | "operator" | null;
  mode: SessionMode;
  db: DatabaseSync;
};

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  };
}

export async function readSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function resolveRequestContext(): Promise<RequestContext> {
  const token = await readSessionToken();
  const session = token ? AuthService.sessionFromToken(token) : null;

  if (session?.mode === "user" && session.user && session.workspace) {
    const membership = getMembership(session.user.id, session.workspace.id);
    if (!membership) {
      throw new ForbiddenError("You cannot access that workspace.");
    }
    return {
      session,
      user: session.user,
      workspace: session.workspace,
      role: membership.role,
      mode: "user",
      db: openWorkspaceDb(session.workspace.id),
    };
  }

  return {
    session,
    user: session?.user ?? null,
    workspace: session?.workspace ?? null,
    role: session?.role ?? "operator",
    mode: "demo",
    db: getDb(),
  };
}

export async function requireUserContext(): Promise<RequestContext> {
  const ctx = await resolveRequestContext();
  if (!ctx.user || ctx.mode !== "user" || !ctx.workspace) throw new UnauthorizedError();
  return ctx;
}

export function withWorkspace(
  handler: (ctx: RequestContext, req: Request, extra?: unknown) => Promise<Response> | Response,
) {
  return async (req?: Request, extra?: unknown) => {
    try {
      const ctx = await resolveRequestContext();
      return await runWithDb(ctx.db, () => handler(ctx, req ?? new Request("http://local.invalid"), extra));
    } catch (error) {
      return authErrorResponse(error);
    }
  };
}

export function withUserWorkspace<T extends Request>(
  handler: (
    ctx: RequestContext & { user: PublicUser; workspace: PublicWorkspace },
    req: T,
    extra?: unknown,
  ) => Promise<Response> | Response,
) {
  return async (req: T, extra?: unknown) => {
    try {
      const ctx = await requireUserContext();
      return await runWithDb(ctx.db, () =>
        handler(ctx as RequestContext & { user: PublicUser; workspace: PublicWorkspace }, req, extra),
      );
    } catch (error) {
      return authErrorResponse(error);
    }
  };
}

export function authErrorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  throw error;
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions());
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export function workspaceOrThrow(workspaceId: string) {
  const workspace = getWorkspace(workspaceId);
  if (!workspace) throw new AuthError("Workspace not found.", 404);
  return workspace;
}
