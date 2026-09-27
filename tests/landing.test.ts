import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getDb, resetDbFile } from "../lib/db";
import { calculateGraphImpact } from "../lib/engine/impact";
import { triggerSupplierDelay } from "../lib/engine/supplier";
import { IDS } from "../lib/ids";
import { CONNECTOR_CATALOG } from "../lib/integrations/catalog";
import { runSimulation } from "../lib/simulation";

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-landing-")), "landing.db");
resetDbFile();

// tsconfig uses jsx: "preserve" (Next compiles JSX); tsx falls back to the classic runtime, which needs React in scope.
(globalThis as unknown as { React: typeof React }).React = React;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const landing = require("../components/public/LandingPage") as typeof import("../components/public/LandingPage");
const { ATLAS_COPY, LANDING_CONNECTORS, LANDING_CTAS, LandingPage } = landing;
const html = renderToStaticMarkup(React.createElement(LandingPage));
const text = html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ");

describe("/welcome landing page", () => {
  it("renders the value proposition and the five how-it-works steps", () => {
    assert.match(text, /Governed business control for distributors/i);
    for (const phrase of ["detects risk early", "explains it in money", "inside your policy", "reality confirms it"]) {
      assert.ok(text.includes(phrase), phrase);
    }
    for (const step of ["Detect", "Explain", "Simulate", "Act with approval", "Verify"]) {
      assert.ok(html.includes(`<p class="mt-2 text-paper">${step}</p>`), step);
    }
  });

  it("uses the exact Atlas wording", () => {
    assert.ok(text.includes("850,000 DZD associated revenue"));
    assert.ok(text.includes("540,000 DZD expected cash timing"));
    assert.ok(text.includes("+3 days moves 160,000 DZD (Invoice C)"));
    assert.ok(text.includes("BLOCKED"));
    assert.equal(/lost revenue|revenue lost/i.test(text), false);
  });

  it("Atlas copy matches what the engines calculate (no invented numbers)", () => {
    const db = getDb();
    triggerSupplierDelay(db);
    const impact = calculateGraphImpact(db, IDS.shipment);
    assert.ok(ATLAS_COPY.associated.startsWith(`${impact.associated_revenue.toLocaleString("en-US")} DZD`));
    assert.ok(ATLAS_COPY.cash.startsWith(`${impact.affected_expected_cash.toLocaleString("en-US")} DZD`));
    const sim = runSimulation(db, { type: "supplier_delay", targetId: IDS.shipment, days: 3 });
    const moved = sim.delta.cash.invoicesMoved.find((inv: { id: string }) => inv.id === IDS.invoiceC);
    assert.equal(moved?.amount, 160000);
    assert.equal(sim.delta.cash.movedToNextPeriod, 160000);
    assert.ok(ATLAS_COPY.simulation.includes(`${sim.delta.cash.movedToNextPeriod.toLocaleString("en-US")} DZD (Invoice C)`));
    assert.equal(sim.isolation.unchanged, true);
  });

  it("has the three CTAs and keeps Home as the demo entry", () => {
    const hrefs = LANDING_CTAS.map((cta) => [cta.label, cta.href]);
    assert.deepEqual(hrefs, [
      ["Try the live demo", "/"],
      ["Create a company", "/?create=1"],
      ["Sign up", "/signup"],
    ]);
    for (const cta of LANDING_CTAS) assert.ok(html.includes(`href="${cta.href.replace("&", "&amp;")}"`), cta.label);
    assert.ok(html.includes('href="/m"'), "mentions the mobile surface");
    const entry = readFileSync(join(__dirname, "..", "components", "company", "EntryWorkspace.tsx"), "utf8");
    assert.match(entry, /get\("create"\) === "1"\) setSurface\("create"\)/, "/?create=1 opens Create a company");
    const home = readFileSync(join(__dirname, "..", "app", "page.tsx"), "utf8");
    assert.match(home, /params\.create === "1"/, "Home renders the entry surface for /?create=1 even when a company is running");
  });

  it("connectors are honest: only backed connectors are Live; CSV/Excel, WhatsApp, MCP are not claimed live", () => {
    const names = LANDING_CONNECTORS.map((c) => c.name);
    for (const required of ["CSV / Excel", "Email", "WhatsApp", "MCP plugins"]) assert.ok(names.includes(required), required);
    const live = LANDING_CONNECTORS.filter((c) => c.state === "Live");
    const backed = CONNECTOR_CATALOG.filter((c) => c.backend).map((c) => c.id);
    assert.ok(backed.includes("manual-profile") && backed.includes("manual-notes"));
    assert.deepEqual(live.map((c) => c.name), ["Business profile & notes"]);
    for (const name of ["CSV / Excel", "WhatsApp", "MCP plugins"]) {
      assert.notEqual(LANDING_CONNECTORS.find((c) => c.name === name)?.state, "Live", name);
    }
  });

  it("contains no testimonials, customer logos or invented metrics", () => {
    assert.equal(/testimonial|trusted by|customers love|logo|\d+%\s+(faster|more|less|fewer)|\d+x\b/i.test(text), false);
    assert.equal(/<img/i.test(html), false);
  });
});
