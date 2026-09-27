/**
 * Who is making a human-only decision (approve / reject / execute / send / autonomy changes).
 *
 * The actor comes ONLY from the server side:
 * - signed in (user mode): the session user; the workspace role must allow the change (403 otherwise).
 * - signed out (public demo): a fixed server-side demo human, on the demo workspace only.
 * A request never names its own actor. A body / query `actor` (or decidedBy / approvedBy …) is ignored,
 * and refused with 400 when it tries to claim an AI / agent / system identity.
 * A stale or invalid session token is 401 (never silently downgraded to the demo actor), and so is a
 * signed-out request when the public demo is turned off (EVOPULSE_PUBLIC_DEMO=false).
 */
import { NextResponse } from "next/server";
import { runWithDb } from "../db";
import { authErrorResponse, resolveRequestContext, type RequestContext } from "./http";
import { assertCanAdmin, assertCanWrite } from "./service";
import { AuthError, UnauthorizedError, type WorkspaceRole } from "./types";

export const DEMO_HUMAN_ACTOR = "Demo operator";

/** Fields a client might use to claim an identity. All are ignored; AI-looking claims are refused. */
export const ACTOR_CLAIM_FIELDS = ["actor", "actorId", "actor_id", "decidedBy", "decided_by", "approvedBy", "approved_by", "approver"] as const;

const AI_CLAIM =
  /^(agent|ai|autopilot|model|assistant|system|deepseek|openrouter|llm|harness|runtime|bot|engine|autonomy-engine|pulse-engine|impact-engine|planner|manus|seed)([\s:_@.-]|$)/i;

export function looksLikeAiActor(value: string): boolean {
  return AI_CLAIM.test(value.trim());
}

export class ActorClaimError extends AuthError {
  constructor(message = "The actor is taken from your session. An AI, agent or system identity can never approve.") {
    super(message, 400);
    this.name = "ActorClaimError";
  }
}

export function publicDemoEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.EVOPULSE_PUBLIC_DEMO || "").trim().toLowerCase() !== "false";
}

/** Refuse (400) an AI / agent / system identity claim in any request-supplied source. Other claims are ignored. */
export function refuseAiActorClaim(...sources: (Record<string, unknown> | null | undefined)[]) {
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    for (const field of ACTOR_CLAIM_FIELDS) {
      const value = source[field];
      if (typeof value === "string" && value.trim() && looksLikeAiActor(value)) throw new ActorClaimError();
    }
  }
}

export type HumanActorLevel = "write" | "admin";

/** The human actor for this request, from the session only. Throws 401 / 403 errors. */
export function sessionHumanActor(ctx: RequestContext, level: HumanActorLevel = "write"): string {
  if (ctx.mode === "user") {
    if (!ctx.user || !ctx.workspace) throw new UnauthorizedError("Sign in to make this decision.");
    const role = (ctx.role === "operator" || !ctx.role ? "viewer" : ctx.role) as WorkspaceRole;
    if (level === "admin") assertCanAdmin(role);
    else assertCanWrite(role);
    const name = (ctx.user.name || "").trim();
    // A person whose display name happens to look like a system identity is recorded by email instead.
    return name && !looksLikeAiActor(name) ? name : ctx.user.email;
  }
  if (ctx.staleSession) throw new UnauthorizedError("Your session has expired. Sign in again.");
  if (!publicDemoEnabled()) throw new UnauthorizedError("Sign in to make this decision.");
  return DEMO_HUMAN_ACTOR;
}

export type HumanRouteContext = RequestContext & { actor: string };

/**
 * Wrap a human-only mutation route. The body is parsed once (JSON, optional) and passed to the handler;
 * actor claims in the body or query string are checked and never used.
 */
export function withHumanActor<Body extends Record<string, unknown> = Record<string, unknown>>(
  level: HumanActorLevel,
  handler: (ctx: HumanRouteContext, body: Body, req: Request, extra?: unknown) => Promise<Response> | Response,
) {
  return async (req?: Request, extra?: unknown) => {
    const request = req ?? new Request("http://local.invalid", { method: "POST" });
    try {
      const ctx = await resolveRequestContext(request);
      const actor = sessionHumanActor(ctx, level);
      const body = (await request
        .clone()
        .json()
        .catch(() => ({}))) as Body;
      const query = Object.fromEntries(new URL(request.url).searchParams.entries());
      refuseAiActorClaim(body && typeof body === "object" ? body : {}, query);
      return await runWithDb(ctx.db, () => handler({ ...ctx, actor }, body && typeof body === "object" ? body : ({} as Body), request, extra));
    } catch (error) {
      if (error instanceof ActorClaimError) return NextResponse.json({ error: error.message }, { status: 400 });
      return authErrorResponse(error);
    }
  };
}
