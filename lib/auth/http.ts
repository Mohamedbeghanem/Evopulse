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
  /** A session token was presented but is invalid or expired (the request fell back to demo). */
  staleSession?: boolean;
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

export async function readSessionToken(req?: Request): Promise<string | null> {
  try {
    const store = await cookies();
    const value = store.get(SESSION_COOKIE)?.value;
    if (value) return value;
  } catch {
    /* outside a Next request scope: fall back to the request's own Cookie header */
  }
  return req ? sessionTokenFromHeader(req.headers.get("cookie")) : null;
}

/** The same httpOnly session cookie, read from a request's Cookie header. */
export function sessionTokenFromHeader(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() === SESSION_COOKIE) {
      const value = part.slice(index + 1).trim();
      try {
        return decodeURIComponent(value) || null;
      } catch {
        return value || null;
      }
    }
  }
  return null;
}

export async function resolveRequestContext(req?: Request): Promise<RequestContext> {
  const token = await readSessionToken(req);
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
    staleSession: Boolean(token) && !session,
  };
}

export async function requireUserContext(req?: Request): Promise<RequestContext> {
  const ctx = await resolveRequestContext(req);
  if (!ctx.user || ctx.mode !== "user" || !ctx.workspace) throw new UnauthorizedError();
  return ctx;
}

export function withWorkspace(
  handler: (ctx: RequestContext, req: Request, extra?: unknown) => Promise<Response> | Response,
) {
  return async (req?: Request, extra?: unknown) => {
    try {
      const ctx = await resolveRequestContext(req);
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
      const ctx = await requireUserContext(req);
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
