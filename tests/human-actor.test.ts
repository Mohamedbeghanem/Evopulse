import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { AuthService, ForbiddenError, UnauthorizedError, SESSION_COOKIE, resetControlDbHandle, sessionHumanActor, refuseAiActorClaim, DEMO_HUMAN_ACTOR } from "../lib/auth";
import { getDb, resetDbFile, getMeta } from "../lib/db";
import { openWorkspaceDb } from "../lib/workspace/db";
import { seedIfEmpty } from "../lib/seed";
import { runManusGoal } from "../lib/agents/manus";
import { applyHumanDecision } from "../lib/agent/executor";
import { loadRun } from "../lib/agent/store";

// Human-only routes take the actor from the server-side session, never from the request.
const dir = mkdtempSync(join(tmpdir(), "evopulse-actor-"));
process.env.CONTROL_DB_PATH = join(dir, "control.db");
process.env.WORKSPACE_DB_DIR = join(dir, "workspaces");
process.env.DB_PATH = join(dir, "demo.db");
delete process.env.OPENROUTER_API_KEY;
delete process.env.EVOPULSE_PUBLIC_DEMO;

resetControlDbHandle();
resetDbFile();

type Handler = (req: Request, extra?: unknown) => Promise<Response>;
const p = (params: Record<string, string>) => ({ params: Promise.resolve(params) });

const ROUTES: { name: string; load: () => Promise<{ POST: unknown }>; params?: Record<string, string>; body?: Record<string, unknown> }[] = [
  { name: "POST /api/agent/runs/:id/approve", load: () => import("../app/api/agent/runs/[id]/approve/route"), params: { id: "agr_x" } },
  { name: "POST /api/agent/runs/:id/reject", load: () => import("../app/api/agent/runs/[id]/reject/route"), params: { id: "agr_x" } },
  { name: "POST /api/plans/:id/actions/:actionId/approve", load: () => import("../app/api/plans/[id]/actions/[actionId]/approve/route"), params: { id: "pln_x", actionId: "act_x" } },
  { name: "POST /api/plans/:id/approve", load: () => import("../app/api/plans/[id]/approve/route"), params: { id: "pln_x" } },
  { name: "POST /api/plans/:id/execute-safe", load: () => import("../app/api/plans/[id]/execute-safe/route"), params: { id: "pln_x" } },
  { name: "POST /api/actions/:id/execute", load: () => import("../app/api/actions/[id]/execute/route"), params: { id: "act_x" } },
  { name: "POST /api/actions/:id/feedback", load: () => import("../app/api/actions/[id]/feedback/route"), params: { id: "act_x" }, body: { decision: "ACCEPT" } },
  { name: "POST /api/autopilot/decisions/:id/approve", load: () => import("../app/api/autopilot/decisions/[id]/approve/route"), params: { id: "apd_x" } },
  { name: "POST /api/autopilot/decisions/:id/reject", load: () => import("../app/api/autopilot/decisions/[id]/reject/route"), params: { id: "apd_x" } },
  { name: "POST /api/autopilot/decisions/:id/take-over", load: () => import("../app/api/autopilot/decisions/[id]/take-over/route"), params: { id: "apd_x" } },
  { name: "POST /api/autopilot/handle-safe", load: () => import("../app/api/autopilot/handle-safe/route") },
  { name: "POST /api/outbound/send", load: () => import("../app/api/outbound/send/route"), body: { draftId: "drf_x" } },
  { name: "POST /api/autonomy/:type/promote", load: () => import("../app/api/autonomy/[actionType]/promote/route"), params: { actionType: "prepare_proposal" } },
  { name: "POST /api/autonomy/:type/suspend", load: () => import("../app/api/autonomy/[actionType]/suspend/route"), params: { actionType: "prepare_proposal" } },
  { name: "POST /api/autonomy/:type/reinstate", load: () => import("../app/api/autonomy/[actionType]/reinstate/route"), params: { actionType: "prepare_proposal" } },
  { name: "POST /api/autonomy/pause", load: () => import("../app/api/autonomy/pause/route") },
  { name: "POST /api/autonomy/resume", load: () => import("../app/api/autonomy/resume/route") },
];

function post(body: Record<string, unknown>, token?: string, query = ""): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.cookie = `other=1; ${SESSION_COOKIE}=${encodeURIComponent(token)}`;
  return new Request(`http://local/api/x${query}`, { method: "POST", headers, body: JSON.stringify(body) });
}

async function call(route: (typeof ROUTES)[number], body: Record<string, unknown>, token?: string, query = "") {
  const mod = (await route.load()) as { POST: Handler };
  return mod.POST(post({ ...(route.body || {}), ...body }, token, query), route.params ? p(route.params) : undefined);
}

describe("human actor · resolution", () => {
  it("comes from the session: user name, demo human, 401 / 403", () => {
    const base = { session: null, workspace: { id: "ws" } as never, db: getDb() };
    assert.equal(sessionHumanActor({ ...base, mode: "user", role: "owner", user: { id: "u", email: "ada@x.test", name: "Ada", emailVerified: true } }), "Ada");
    assert.equal(sessionHumanActor({ ...base, mode: "user", role: "member", user: { id: "u", email: "sys@x.test", name: "System", emailVerified: true } }), "sys@x.test");
    assert.throws(() => sessionHumanActor({ ...base, mode: "user", role: "viewer", user: { id: "u", email: "v@x.test", name: "Vi", emailVerified: true } }), ForbiddenError);
    assert.throws(() => sessionHumanActor({ ...base, mode: "user", role: "member", user: { id: "u", email: "m@x.test", name: "M", emailVerified: true } }, "admin"), ForbiddenError);
    assert.throws(() => sessionHumanActor({ ...base, mode: "user", role: "owner", user: null }), UnauthorizedError);
    assert.equal(sessionHumanActor({ ...base, workspace: null, mode: "demo", role: "operator", user: null }), DEMO_HUMAN_ACTOR);
    assert.throws(() => sessionHumanActor({ ...base, workspace: null, mode: "demo", role: "operator", user: null, staleSession: true }), UnauthorizedError);
    process.env.EVOPULSE_PUBLIC_DEMO = "false";
    try {
      assert.throws(() => sessionHumanActor({ ...base, workspace: null, mode: "demo", role: "operator", user: null }), UnauthorizedError);
    } finally {
      delete process.env.EVOPULSE_PUBLIC_DEMO;
    }
  });

  it("refuses AI / agent / system identity claims, ignores other claims", () => {
    for (const claim of ["agent:agr_1", "AI", "system", "autopilot", "openrouter", "manus", "bot", "assistant-1"]) {
      assert.throws(() => refuseAiActorClaim({ actor: claim }), /AI, agent or system identity/, claim);
      assert.throws(() => refuseAiActorClaim({}, { decidedBy: claim }), /AI, agent or system identity/, claim);
    }
    refuseAiActorClaim({ actor: "Mallory" }, { approvedBy: "Bob" });
  });
});

describe("human actor · every human-only route", { concurrency: 1 }, () => {
  it("refuses an AI actor claim in the body or query with 400", async () => {
    for (const route of ROUTES) {
      assert.equal((await call(route, { actor: "agent:agr_evil" })).status, 400, route.name);
      assert.equal((await call(route, {}, undefined, "?actor=system")).status, 400, `${route.name} (query)`);
    }
  });

  it("no session outside the public demo is 401; a stale session token is 401", async () => {
    process.env.EVOPULSE_PUBLIC_DEMO = "false";
    try {
      for (const route of ROUTES) assert.equal((await call(route, { actor: "Mallory" })).status, 401, route.name);
    } finally {
      delete process.env.EVOPULSE_PUBLIC_DEMO;
    }
    for (const route of ROUTES) assert.equal((await call(route, {}, "not-a-real-session-token")).status, 401, `${route.name} (stale)`);
  });

  it("connector write approvals: signed-in only (401), AI claim refused (400)", async () => {
    const mod = await import("../app/api/connectors/actions/[id]/route");
    assert.equal((await mod.POST(post({ decision: "approve" }), { params: Promise.resolve({ id: "act_x" }) })).status, 401);
    assert.equal((await mod.POST(post({ decision: "approve", actor: "agent:x" }), { params: Promise.resolve({ id: "act_x" }) })).status, 400);
  });
});

describe("human actor · happy paths", { concurrency: 1 }, () => {
  it("public demo: body actor is ignored; the fixed demo human decides (Manus approval + plan action + execute)", async () => {
    const db = getDb();
    const view = await runManusGoal(db, { goal: "Protect everything at risk this week.", provider: null });
    const approval = view.approvals[0];
    const approve = ROUTES[0];
    const res = await (await approve.load() as { POST: Handler }).POST(post({ approvalId: approval.id, actor: "Mallory" }), p({ id: view.id }));
    assert.equal(res.status, 200);
    const decided = loadRun(db, view.id).approvals.find((a) => a.id === approval.id)!;
    assert.equal(decided.status, "approved");
    assert.equal(decided.decidedBy, DEMO_HUMAN_ACTOR);

    // Mobile / desktop action approve → execute with a spoofed name: accepted, recorded as the demo human.
    const next = loadRun(db, view.id).approvals.find((a) => a.status === "pending")!;
    const row = db.prepare("SELECT plan_id FROM actions WHERE id = ?").get(next.actionId) as { plan_id: string };
    const approveAction = (await ROUTES[2].load()) as { POST: Handler };
    const ok = await approveAction.POST(post({ actor: "Mallory" }), p({ id: row.plan_id, actionId: next.actionId }));
    assert.equal(ok.status, 200, await ok.clone().text());
    const who = db.prepare("SELECT decided_by FROM approvals WHERE action_id = ? ORDER BY decided_at DESC LIMIT 1").get(next.actionId) as { decided_by: string };
    assert.equal(who.decided_by, DEMO_HUMAN_ACTOR);
    const execute = (await ROUTES[5].load()) as { POST: Handler };
    const executed = await execute.POST(post({ actor: "Mallory" }), p({ id: next.actionId }));
    assert.equal(executed.status, 200, await executed.clone().text());
    const status = (db.prepare("SELECT status FROM actions WHERE id = ?").get(next.actionId) as { status: string }).status;
    assert.equal(status, "executed", "EXECUTED is recorded — HANDLED only comes from verification");
  });

  it("signed in: the session user decides; a viewer gets 403", async () => {
    const owner = AuthService.signup({ email: "ada-owner@example.com", password: "password1", name: "Ada Owner" });
    const wsDb = openWorkspaceDb(owner.workspace.id);
    wsDb.exec("DELETE FROM entities");
    seedIfEmpty(wsDb);
    const view = await runManusGoal(wsDb, { goal: "Protect everything at risk this week.", provider: null });
    assert.ok(view.approvals.length >= 2);
    const route = (await ROUTES[0].load()) as { POST: Handler };

    const viewer = AuthService.signup({ email: "vic-viewer@example.com", password: "password2", name: "Vic" });
    AuthService.addMember(owner.workspace.id, "owner", "vic-viewer@example.com", "viewer");
    AuthService.switchWorkspace(viewer.session.token, owner.workspace.id);
    const denied = await route.POST(post({ approvalId: view.approvals[0].id, actor: "Ada Owner" }, viewer.session.token), p({ id: view.id }));
    assert.equal(denied.status, 403);
    assert.equal(loadRun(wsDb, view.id).approvals[0].status, "pending");

    const res = await route.POST(post({ approvalId: view.approvals[0].id, actor: "Mallory" }, owner.session.token), p({ id: view.id }));
    assert.equal(res.status, 200, await res.clone().text());
    const decided = loadRun(wsDb, view.id).approvals.find((a) => a.id === view.approvals[0].id)!;
    assert.equal(decided.decidedBy, "Ada Owner");
    // The signed-in request acted on the user's workspace, not the demo workspace.
    assert.throws(() => loadRun(getDb(), view.id), /not found/i);
  });

  it("an AI actor can never approve, even if it reaches the engine directly", async () => {
    const db = getDb();
    const view = await runManusGoal(db, { goal: "Protect everything at risk this week.", provider: null });
    const pending = view.approvals.find((a) => a.status === "pending")!;
    for (const actor of ["agent:" + view.id, "autopilot", "system", "openrouter"]) {
      assert.throws(() => applyHumanDecision(db, view.id, { approvalId: pending.id, decision: "approve", actor }, getMeta(db, "demo_now")), /AI cannot approve/);
    }
    assert.equal(loadRun(db, view.id).approvals.find((a) => a.id === pending.id)!.status, "pending");
  });
});
