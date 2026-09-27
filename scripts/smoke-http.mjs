#!/usr/bin/env node
// Golden-path smoke test over HTTP against a running EvoPulse (local `next start`, Docker, Fly, Render).
//   node scripts/smoke-http.mjs http://localhost:3000
// WARNING: it calls POST /api/demo/reset — it resets the Atlas DEMO database (not user workspaces).
const BASE = (process.argv[2] || process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
let failures = 0;
const ok = (cond, label, extra = "") => {
  if (!cond) failures += 1;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? `  — ${extra}` : ""}`);
};
async function call(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* html */
  }
  return { status: res.status, json, text };
}
const item = (pulse, exceptionId) => pulse.attention.items.find((i) => i.sourceExceptionId === exceptionId);

const health = await call("GET", "/api/health");
ok(health.status === 200 && health.json?.ok === true, "GET /api/health", `node ${health.json?.node}`);

await call("POST", "/api/demo/reset");
await call("POST", "/api/demo/supplier-delay");
let pulse = (await call("GET", "/api/pulse")).json;
const cascade = item(pulse, "exc_shipment_delay");
ok(cascade?.impact.associatedRevenue === 850000, "Atlas delay: 850,000 DZD associated revenue", cascade?.classification);
ok(cascade?.impact.expectedCash === 540000, "Atlas delay: 540,000 DZD expected cash timing");

const fpBefore = (await call("GET", "/api/simulations")).json?.fingerprint;
const sim = (await call("POST", "/api/simulations", { type: "supplier_delay", targetId: "ent_ship_204", days: 3 })).json;
const fpAfter = (await call("GET", "/api/simulations")).json?.fingerprint;
ok(sim?.delta?.cash?.movedToNextPeriod === 160000, "+3 days: 160,000 DZD cash moves into next period");
const invoiceC = (sim?.delta?.cash?.invoicesMoved || []).find((inv) => inv.id === "ent_inv_c");
ok(invoiceC?.amount === 160000, "+3 days: the moved 160K is Invoice C", invoiceC?.label);
ok(sim?.isolation?.unchanged === true && fpBefore && fpBefore === fpAfter, "Simulation never mutates reality", `fingerprint ${fpBefore}`);

const protect = await call("POST", "/api/ask", { message: "Protect everything at risk this week." });
ok(protect.status === 200 && !/HANDLED/.test(String(protect.json?.status || "")), "Protect everything at risk this week (via /api/ask)", String(protect.json?.status || protect.json?.intent || ""));

// Human approval of the 320K follow-up through the SAME human routes the /m Approve button uses.
const m320 = await call("GET", `/m/s/${encodeURIComponent("exception:exc_proposal_missed")}`);
ok(m320.status === 200 && m320.text.includes('data-testid="m-approve"'), "/m situation shows a human Approve for APPROVAL_REQUIRED");
const approve = await call("POST", "/api/plans/pln_recovery_320k/actions/act_draft_followup/approve");
const execute = await call("POST", "/api/actions/act_draft_followup/execute");
ok(approve.status === 200 && execute.status === 200, "Approve → execute via human routes (policy rechecked)", `${approve.status}/${execute.status}`);
pulse = (await call("GET", "/api/pulse")).json;
const afterExec = item(pulse, "exc_proposal_missed");
ok(afterExec && afterExec.classification !== "HANDLED", "EXECUTED != HANDLED (before verification)", afterExec?.classification);
const pending = (await call("GET", "/api/verifications?exception_id=exc_proposal_missed")).json?.verifications || [];
ok(pending.some((v) => v.status === "PENDING"), "Verification PENDING after execution");

// Amine's later message (the 10% request) is also his reply → verifies only his follow-up.
await call("POST", "/api/demo/discount");
pulse = (await call("GET", "/api/pulse")).json;
const blocked = item(pulse, "exc_discount_blocked");
ok(blocked?.classification === "BLOCKED", "10% discount BLOCKED (discount_max 5%)");
const tryTen = await call("POST", "/api/plans/pln_discount_alt/actions/act_apply_10/approve");
ok(tryTen.status >= 400, "Human route refuses to approve 10% (policy recheck)", `${tryTen.status} ${tryTen.json?.error || ""}`);
const mBlocked = await call("GET", `/m/s/${encodeURIComponent("exception:exc_discount_blocked")}`);
const blockedCard = mBlocked.text.split('data-testid="m-blocked"')[1]?.split('data-testid="m-approval"')[0] || "";
ok(mBlocked.status === 200 && blockedCard.includes("BLOCKED") && !blockedCard.includes('data-testid="m-approve"'), "/m shows 10% BLOCKED with no approve control");
const handled = item(pulse, "exc_proposal_missed");
ok(handled?.classification === "HANDLED", "HANDLED only after same-party verification (Amine replied)", handled?.classification);
ok(item(pulse, "exc_shipment_delay")?.classification !== "HANDLED", "Amine's reply does not verify the supplier cascade");

const mHome = await call("GET", "/m");
const needs = mHome.text.match(/data-testid="m-count-needs"[^>]*>(\d+)</)?.[1];
ok(Number(needs) === pulse.attention.needsMe.length, "/m 'Needs me' count equals pulseSummary", `${needs} vs ${pulse.attention.needsMe.length}`);

console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
