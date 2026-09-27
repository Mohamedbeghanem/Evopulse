import type { DatabaseSync } from "node:sqlite";
import { getMeta, one, setMeta } from "../db";
import { pulseSummary } from "../engine/pulse";
import { calculateGraphImpact } from "../engine/impact";
import { triggerSupplierDelay } from "../engine/supplier";
import { IDS } from "../ids";
import { wipeAndSeed } from "../seed";
import { isDeepTemplate, resolveCompanyTemplate, type CompanyTemplateId } from "./templates";
import { companyCensus } from "./world";

export const WORKSPACE_MODE_KEY = "workspace_mode";
export const COMPANY_TEMPLATE_KEY = "company_template";
export const COMPANY_NAME_KEY = "company_name";
export const COMPANY_PROMPT_KEY = "company_prompt";

export type WorkspaceMode = "entry" | "running";

export type CompanySnapshot = {
  mode: WorkspaceMode;
  template: string;
  companyName: string;
  prompt: string;
  ready: boolean;
  census: ReturnType<typeof companyCensus>;
  canonical: {
    orders: number;
    customers: number;
    associatedRevenue: number;
    expectedCash: number;
  };
  pulse: {
    headline: string;
    needsYou: number;
    monitoring: number;
    handledAutomatically: number;
  };
};

export function workspaceMode(db: DatabaseSync): WorkspaceMode {
  const value = getMeta(db, WORKSPACE_MODE_KEY, "entry");
  return value === "running" ? "running" : "entry";
}

export function markWorkspace(db: DatabaseSync, mode: WorkspaceMode) {
  setMeta(db, WORKSPACE_MODE_KEY, mode);
}

export function companySnapshot(db: DatabaseSync): CompanySnapshot {
  const now = getMeta(db, "demo_now");
  const pulse = pulseSummary(db, now);
  const summary = pulse.attention.summary;
  const canonical = calculateGraphImpact(db, IDS.shipment);
  const company = one<{ name: string }>(db, "SELECT name FROM entities WHERE id = ?", [IDS.company]);
  return {
    mode: workspaceMode(db),
    template: getMeta(db, COMPANY_TEMPLATE_KEY, "distribution"),
    companyName: getMeta(db, COMPANY_NAME_KEY, "") || company?.name || "Atlas Medical Distribution",
    prompt: getMeta(db, COMPANY_PROMPT_KEY, ""),
    ready: workspaceMode(db) === "running",
    census: companyCensus(db),
    canonical: {
      orders: canonical.affected_orders.length,
      customers: canonical.affected_customers.length,
      associatedRevenue: canonical.associated_revenue,
      expectedCash: canonical.affected_expected_cash,
    },
    pulse: {
      headline: pulse.headline,
      needsYou: summary.needsYou + summary.needsApproval,
      monitoring: summary.monitoring,
      handledAutomatically: summary.handled + summary.autoHandled,
    },
  };
}

export function generateDistributionCompany(
  db: DatabaseSync,
  options: { activate?: boolean; triggerDelay?: boolean; prompt?: string } = {},
): CompanySnapshot {
  wipeAndSeed(db);
  if (options.triggerDelay) triggerSupplierDelay(db);
  setMeta(db, COMPANY_TEMPLATE_KEY, "distribution");
  setMeta(db, COMPANY_NAME_KEY, "Atlas Medical Distribution");
  setMeta(db, COMPANY_PROMPT_KEY, options.prompt || "");
  markWorkspace(db, options.activate === false ? "entry" : "running");
  return companySnapshot(db);
}

export function openDemoCompany(db: DatabaseSync): CompanySnapshot {
  return generateDistributionCompany(db, {
    activate: true,
    triggerDelay: true,
    prompt: "Open demo company",
  });
}

export function createCompany(
  db: DatabaseSync,
  input: { prompt?: string; template?: string } = {},
): CompanySnapshot {
  const template = resolveCompanyTemplate(input.prompt || "", input.template);
  if (!isDeepTemplate(template.id)) {
    const error = new Error(
      `${template.label} is a demo template. Only Distribution has a live Control OS simulation.`,
    );
    (error as Error & { status: number; template: CompanyTemplateId }).status = 409;
    (error as Error & { template: CompanyTemplateId }).template = template.id;
    throw error;
  }
  return generateDistributionCompany(db, {
    activate: true,
    triggerDelay: true,
    prompt: input.prompt || template.suggestion,
  });
}

export function returnToCreateSurface(db: DatabaseSync): CompanySnapshot {
  markWorkspace(db, "entry");
  return companySnapshot(db);
}

export function resetWorkspace(db: DatabaseSync): CompanySnapshot {
  wipeAndSeed(db);
  markWorkspace(db, "entry");
  return companySnapshot(db);
}
