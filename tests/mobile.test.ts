import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { getDb, getMeta, resetDbFile } from "../lib/db";
import { pulseSummary } from "../lib/engine/pulse";
import { triggerSupplierDelay } from "../lib/engine/supplier";
import { ingestSeedDiscount } from "../lib/engine/ingest";
import { IDS } from "../lib/ids";
import { HUMAN_ROUTES, mobileSituationHref } from "../lib/mobile/routes";
import { mobileHome, mobileSituation } from "../lib/mobile/view";
import { stateFingerprint } from "../lib/simulation";
import { POST as approveActionRoute } from "../app/api/plans/[id]/actions/[actionId]/approve/route";
import { POST as executeActionRoute } from "../app/api/actions/[id]/execute/route";
import { POST as rejectDecisionRoute } from "../app/api/autopilot/decisions/[id]/reject/route";
import { GET as healthRoute } from "../app/api/health/route";

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-mobile-")), "mobile.db");
delete process.env.OPENROUTER_API_KEY;
resetDbFile();

const ROOT = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const MISSED = `exception:${IDS.excMissed}`;
const DELAY = `exception:${IDS.excDelay}`;
const DISCOUNT = "exception:exc_discount_blocked";

function assertCountsMatchPulse() {
  const db = getDb();
  const now = getMeta(db, "demo_now");
  const home = mobileHome(db, now);
  const pulse = pulseSummary(db, now);
  assert.equal(home.counts.needsMe, pulse.attention.needsMe.length);
  assert.equal(home.counts.watching, pulse.attention.watching.length);
  assert.equal(home.counts.handled, pulse.attention.handled.length);
  assert.equal(home.counts.blocked, pulse.attention.summary.blocked);
  assert.equal(home.counts.needsApproval, pulse.attention.summary.needsApproval);
  assert.deepEqual(
    home.needsMe.map((card) => card.id),
    pulse.attention.needsMe.map((item) => item.id),
  );
  assert.equal(home.headline, pulse.headline);
  return home;
}

function params<T>(value: T) {
  return { params: Promise.resolve(value) };
}
const post = (path: string) => new Request(`http://local.test${path}`, { method: "POST", body: "{}" });

describe("/m mobile surface reads the canonical engines", { concurrency: 1 }, () => {
  it("'What needs me?' counts equal pulseSummary at every demo phase", async () => {
    let home = assertCountsMatchPulse();
    assert.deepEqual(home.needsMe.map((card) => card.id), [MISSED]);
    triggerSupplierDelay(getDb());
    home = assertCountsMatchPulse();
    assert.equal(home.counts.needsMe, 2);
    await ingestSeedDiscount(getDb());
    home = assertCountsMatchPulse();
    assert.equal(home.counts.blocked, 1);
    assert.ok(home.needsMe.every((card) => card.href === mobileSituationHref(card.id)));
  });

  it("Why uses the canonical wording: 850K associated revenue, 540K expected cash timing", () => {
    const situation = mobileSituation(getDb(), DELAY);
    assert.ok(situation);
    assert.ok(situation.item.why.includes("850,000 DZD associated revenue — not a loss."));
    assert.ok(situation.item.why.includes("540,000 DZD expected cash timing."));
    assert.equal(situation.item.why.some((line) => /lost revenue|revenue lost/i.test(line)), false);
  });

  it("10% discount is BLOCKED with no approve control; only APPROVAL_REQUIRED actions are approvable", () => {
    const situation = mobileSituation(getDb(), DISCOUNT);
    assert.ok(situation);
    assert.equal(situation.item.classification, "BLOCKED");
    assert.equal(situation.discountMax, "5");
    const ten = situation.actions.find((action) => action.id === "act_apply_10");
    assert.ok(ten);
    assert.equal(ten.blocked, true);
    assert.equal(ten.canApprove, false);
    for (const action of situation.actions.filter((a) => a.canApprove)) {
      assert.equal(action.policyOutcome, "APPROVAL_REQUIRED");
      assert.notEqual(action.status, "executed");
    }
  });

  it("the human approve route refuses the 10% action (policy recheck) and changes nothing", async () => {
    const res = await approveActionRoute(post("/x"), params({ id: "pln_discount_alt", actionId: "act_apply_10" }));
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.match(body.error, /discount_max/);
    const row = getDb().prepare("SELECT status, policy_outcome FROM actions WHERE id = 'act_apply_10'").get() as {
      status: string;
      policy_outcome: string;
    };
    assert.equal(row.policy_outcome, "BLOCKED");
    assert.notEqual(row.status, "executed");
    const exec = await executeActionRoute(post("/x"), params({ id: "act_apply_10" }));
    assert.equal(exec.status, 400);
  });

  it("execute refuses an APPROVAL_REQUIRED action a human has not approved", async () => {
    const res = await executeActionRoute(post("/x"), params({ id: "act_draft_followup" }));
    assert.equal(res.status, 400);
    assert.match(((await res.json()) as { error: string }).error, /needs approval/);
  });

  it("human reject goes through the autopilot decision route and keeps the situation with the human", async () => {
    const before = mobileSituation(getDb(), MISSED);
    assert.ok(before?.item.decisionId);
    assert.equal(before.canReject, true);
    const res = await rejectDecisionRoute(post("/x"), params({ id: before.item.decisionId }));
    assert.equal(res.status, 200);
    const after = mobileSituation(getDb(), MISSED);
    assert.equal(after?.item.classification, "NEEDS_YOU");
    assert.equal(after?.actions.find((a) => a.id === "act_draft_followup")?.status, "proposed");
  });

  it("approve → execute through the SAME human routes: EXECUTED is not HANDLED until verification", async () => {
    const situation = mobileSituation(getDb(), MISSED);
    const draft = situation?.actions.find((action) => action.canApprove);
    assert.ok(draft?.planId);
    const approved = await approveActionRoute(post("/x"), params({ id: draft.planId, actionId: draft.id }));
    assert.equal(approved.status, 200);
    const executed = await executeActionRoute(post("/x"), params({ id: draft.id }));
    assert.equal(executed.status, 200);
    const after = mobileSituation(getDb(), MISSED);
    assert.ok(after);
    assert.notEqual(after.item.classification, "HANDLED");
    assert.equal(after.handled, false);
    assert.equal(after.executedNotHandled, true);
    assert.ok(after.verifications.some((row) => row.status === "PENDING"));
    const home = assertCountsMatchPulse();
    assert.equal(home.handled.some((card) => card.id === MISSED), false);
    assert.ok(home.verifications.some((row) => row.actionId === draft.id && row.status === "PENDING"));
  });
});

describe("/m client code only uses human routes", () => {
  const decision = read("components/mobile/MobileDecision.tsx");
  const desktop = read("components/ApproveActionButton.tsx");

  it("mobile approve/execute paths are the desktop human routes", () => {
    assert.equal(HUMAN_ROUTES.approveAction("pln_a", "act_b"), "/api/plans/pln_a/actions/act_b/approve");
    assert.equal(HUMAN_ROUTES.executeAction("act_b"), "/api/actions/act_b/execute");
    assert.match(desktop, /\/api\/plans\/\$\{planId\}\/actions\/\$\{actionId\}\/approve/);
    assert.match(desktop, /\/api\/actions\/\$\{actionId\}\/execute/);
    assert.match(decision, /HUMAN_ROUTES\.approveAction/);
    assert.match(decision, /HUMAN_ROUTES\.executeAction/);
  });

  it("no mobile file calls the agent approval tool, agent runs, or a private endpoint", () => {
    const files = [
      "components/mobile/MobileDecision.tsx",
      "components/mobile/MobileAsk.tsx",
      "app/m/page.tsx",
      "app/m/s/[id]/page.tsx",
      "app/m/ask/page.tsx",
      "lib/mobile/view.ts",
      "lib/mobile/routes.ts",
    ];
    for (const file of files) {
      const source = read(file);
      assert.equal(/approve_action|\/api\/agent\/runs|execute-safe|handle-safe/.test(source), false, file);
      assert.equal(/fetch\(\s*["'`]\/api\/(?!ask)/.test(source), false, `${file} must use HUMAN_ROUTES`);
    }
  });

  it("the approve control is only rendered for canApprove actions (blocked cards have none)", () => {
    const page = read("app/m/s/[id]/page.tsx");
    assert.match(page, /actions\.filter\(\(action\) => action\.canApprove\)/);
    const blockedBlock = page.slice(page.indexOf("{blocked.map"), page.indexOf("{approvable.map"));
    assert.ok(blockedBlock.length > 0);
    assert.equal(blockedBlock.includes("MobileApprove"), false);
  });
});

describe("PWA install shell", () => {
  it("manifest is installable and scoped to /m", () => {
    const manifest = JSON.parse(read("public/manifest.webmanifest")) as {
      start_url: string;
      scope: string;
      display: string;
      icons: { src: string; sizes: string; purpose?: string }[];
    };
    assert.equal(manifest.start_url, "/m");
    assert.equal(manifest.scope, "/m");
    assert.equal(manifest.display, "standalone");
    for (const size of ["192x192", "512x512"]) assert.ok(manifest.icons.some((icon) => icon.sizes === size));
    assert.ok(manifest.icons.some((icon) => icon.purpose === "maskable"));
    for (const icon of manifest.icons) assert.ok(existsSync(join(ROOT, "public", icon.src)), icon.src);
  });

  it("service worker never intercepts /api or non-GET requests", () => {
    const sw = read("public/sw.js");
    assert.match(sw, /request\.method !== "GET"\) return/);
    assert.match(sw, /startsWith\("\/api\/"\)\) return/);
  });
});

describe("GET /api/health", () => {
  it("returns ok and is read-only", async () => {
    const db = getDb();
    const before = stateFingerprint(db).hash;
    const events = (db.prepare("SELECT COUNT(*) AS n FROM events").get() as { n: number }).n;
    const res = await healthRoute();
    assert.equal(res.status, 200);
    const body = (await res.json()) as { ok: boolean; db: string; node: string };
    assert.equal(body.ok, true);
    assert.equal(body.db, "sqlite");
    assert.match(body.node, /^\d+\./);
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.equal(stateFingerprint(db).hash, before);
    assert.equal((db.prepare("SELECT COUNT(*) AS n FROM events").get() as { n: number }).n, events);
  });
});
