import type { DatabaseSync } from "node:sqlite";
import { all, getMeta, one } from "../db";
import { companyCensus } from "../company/world";
import { calculateGraphImpact } from "../engine/impact";
import { getDownstream } from "../graph";
import { IDS } from "../ids";

/**
 * Read-only business view over the seeded world (entities + graph + commitments).
 * Never writes. Every row comes from the database — there is no mock company data in the UI.
 */

type EntityRow = { id: string; type: string; name: string; payload: string };
type EdgeRow = { source_node_id: string; target_node_id: string; relationship: string };
type CommitmentRow = { id: string; actor: string; description: string; deadline: string | null; status: string };

export type BusinessRow = {
  id: string;
  name: string;
  city?: string;
  role?: string;
  amount?: number;
  currency?: string;
  dueAt?: string;
  status?: string;
  sku?: string;
  inventory?: number;
  /** Linked entity names resolved from graph edges. */
  links: { relationship: string; id: string; name: string }[];
  /** True when the row sits downstream of Atlas Supply → SH-204 → RK-7. */
  onSupplierPath: boolean;
};

export type BusinessOverview = {
  company: { id: string; name: string; city?: string; sector?: string };
  census: ReturnType<typeof companyCensus>;
  suppliers: BusinessRow[];
  customers: BusinessRow[];
  orders: BusinessRow[];
  invoices: BusinessRow[];
  products: BusinessRow[];
  shipments: BusinessRow[];
  commitments: { id: string; actor: string; description: string; deadline: string | null; status: string }[];
  canonical: {
    supplier: string;
    shipment: string;
    product: string;
    orders: number;
    customers: number;
    associatedRevenue: number;
    expectedCash: number;
    orderIds: string[];
    customerIds: string[];
    invoiceIds: string[];
  };
  supplierDelayed: boolean;
};

function parse(raw: string): Record<string, unknown> {
  try {
    const value = JSON.parse(raw || "{}") as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function businessOverview(db: DatabaseSync): BusinessOverview {
  const entities = all<EntityRow>(db, "SELECT id, type, name, payload FROM entities ORDER BY created_at, id");
  const names = new Map(entities.map((entity) => [entity.id, entity.name]));
  const edges = all<EdgeRow>(db, "SELECT source_node_id, target_node_id, relationship FROM graph_edges");
  const onPath = new Set(getDownstream(db, IDS.supplier).hits.map((hit) => hit.node.entity_id || hit.node.id));
  onPath.add(IDS.supplier);

  const toRow = (entity: EntityRow): BusinessRow => {
    const payload = parse(entity.payload);
    const links = edges
      .filter((edge) => edge.source_node_id === entity.id || edge.target_node_id === entity.id)
      .map((edge) => {
        const other = edge.source_node_id === entity.id ? edge.target_node_id : edge.source_node_id;
        return { relationship: edge.relationship, id: other, name: names.get(other) ?? other };
      })
      .filter((link) => names.has(link.id));
    return {
      id: entity.id,
      name: entity.name,
      city: str(payload.city),
      role: str(payload.role),
      amount: num(payload.amount),
      currency: str(payload.currency),
      dueAt: str(payload.dueAt) ?? str(payload.expectedAt),
      status: str(payload.status),
      sku: str(payload.sku),
      inventory: num(payload.inventory),
      links,
      onSupplierPath: onPath.has(entity.id),
    };
  };

  const ofType = (type: string) => entities.filter((entity) => entity.type === type).map(toRow);
  const companyEntity = entities.find((entity) => entity.id === IDS.company);
  const companyPayload = parse(companyEntity?.payload ?? "{}");
  const impact = calculateGraphImpact(db, IDS.shipment);
  const commitments = all<CommitmentRow>(
    db,
    "SELECT id, actor, description, deadline, status FROM commitments ORDER BY deadline, id",
  );
  const product = one<{ name: string }>(db, "SELECT name FROM entities WHERE id = ?", [IDS.product]);

  return {
    company: {
      id: IDS.company,
      name: getMeta(db, "company_name", "") || companyEntity?.name || "",
      city: str(companyPayload.city),
      sector: str(companyPayload.sector),
    },
    census: companyCensus(db),
    suppliers: ofType("supplier"),
    customers: ofType("customer"),
    orders: ofType("order"),
    invoices: ofType("invoice"),
    products: ofType("product"),
    shipments: ofType("shipment"),
    commitments,
    canonical: {
      supplier: names.get(IDS.supplier) ?? "",
      shipment: names.get(IDS.shipment) ?? "",
      product: product?.name ?? "",
      orders: impact.affected_orders.length,
      customers: impact.affected_customers.length,
      associatedRevenue: impact.associated_revenue,
      expectedCash: impact.affected_expected_cash,
      orderIds: impact.affected_orders.map((order) => order.id),
      customerIds: impact.affected_customers.map((customer) => customer.id),
      invoiceIds: impact.affected_invoices.map((invoice) => invoice.id),
    },
    supplierDelayed: getMeta(db, "supplier_phase", "stable") === "delayed",
  };
}
