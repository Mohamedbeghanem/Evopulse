import type { DatabaseSync } from "node:sqlite";
import { all, audit, one, run, runWithDb } from "../db";
import { EVENT_TYPES, eventsFor } from "../events";
import { graphFor } from "../graph";
import { upsertExpectation } from "../engine/expectations";
import { boundedText, looksLikeInstruction, UNTRUSTED_MARKER } from "./data";
import { readTabular, type Tabular } from "./tabular";

export const IMPORT_TYPES = ["customer", "supplier", "product", "order", "invoice"] as const;
export type ImportType = (typeof IMPORT_TYPES)[number];

type FieldSpec = { key: string; aliases: string[]; required?: boolean; kind?: "number" | "date" | "text" };

const FIELDS: Record<ImportType, FieldSpec[]> = {
  customer: [
    { key: "ref", aliases: ["id", "ref", "reference", "code", "customer_id", "customer_code", "external_id", "account"] },
    { key: "name", aliases: ["name", "customer", "customer_name", "company", "account_name", "client"], required: true },
    { key: "email", aliases: ["email", "e_mail", "mail"] },
    { key: "phone", aliases: ["phone", "telephone", "mobile", "whatsapp"] },
    { key: "city", aliases: ["city", "town", "wilaya"] },
    { key: "country", aliases: ["country"] },
  ],
  supplier: [
    { key: "ref", aliases: ["id", "ref", "reference", "code", "supplier_id", "supplier_code", "vendor_id", "external_id"] },
    { key: "name", aliases: ["name", "supplier", "supplier_name", "vendor", "vendor_name", "company"], required: true },
    { key: "email", aliases: ["email", "mail"] },
    { key: "phone", aliases: ["phone", "telephone", "mobile"] },
    { key: "city", aliases: ["city", "town"] },
    { key: "role", aliases: ["role", "category", "supplies"] },
  ],
  product: [
    { key: "ref", aliases: ["sku", "id", "ref", "code", "product_id", "item_code"] },
    { key: "name", aliases: ["name", "product", "product_name", "item", "description", "title"], required: true },
    { key: "inventory", aliases: ["inventory", "stock", "qty", "quantity", "on_hand"], kind: "number" },
    { key: "price", aliases: ["price", "unit_price", "cost"], kind: "number" },
    { key: "supplier", aliases: ["supplier", "supplier_name", "vendor", "supplier_id"] },
  ],
  order: [
    { key: "ref", aliases: ["order", "order_id", "order_number", "order_no", "id", "ref", "reference", "number", "po"], required: true },
    { key: "name", aliases: ["name", "title", "description", "label"] },
    { key: "customer", aliases: ["customer", "customer_name", "customer_id", "client", "account"] },
    { key: "amount", aliases: ["amount", "total", "value", "order_total", "revenue", "price"], kind: "number", required: true },
    { key: "currency", aliases: ["currency", "ccy", "cur"] },
    { key: "dueAt", aliases: ["due", "due_date", "due_at", "delivery_date", "deliver_by", "ship_by", "promised_date", "date"], kind: "date" },
    { key: "status", aliases: ["status", "state", "stage"] },
    { key: "product", aliases: ["product", "sku", "item", "product_id"] },
  ],
  invoice: [
    { key: "ref", aliases: ["invoice", "invoice_id", "invoice_number", "invoice_no", "id", "ref", "reference", "number"], required: true },
    { key: "customer", aliases: ["customer", "customer_name", "customer_id", "client", "account", "bill_to"] },
    { key: "order", aliases: ["order", "order_id", "order_number", "order_ref", "po"] },
    { key: "amount", aliases: ["amount", "total", "amount_due", "balance", "value"], kind: "number", required: true },
    { key: "currency", aliases: ["currency", "ccy", "cur"] },
    { key: "dueAt", aliases: ["due", "due_date", "due_at", "payment_due", "date_due"], kind: "date" },
    { key: "status", aliases: ["status", "state", "payment_status"] },
    { key: "paidAt", aliases: ["paid_at", "paid_on", "payment_date", "paid_date"], kind: "date" },
  ],
};

const TYPE_HINTS: Record<ImportType, RegExp> = {
  invoice: /invoice/,
  order: /order|po_/,
  product: /sku|product|inventory|stock/,
  supplier: /supplier|vendor/,
  customer: /customer|client|account/,
};

export type ImportRow = { row: number; values: Record<string, string | number | null>; flagged: boolean };
export type ImportIssue = { row: number; field: string; message: string };

export type ImportPreview = {
  type: ImportType;
  fileName: string;
  headers: string[];
  mapping: Record<string, string | null>;
  unmapped: string[];
  total: number;
  valid: number;
  invalid: number;
  rows: ImportRow[];
  errors: ImportIssue[];
  warnings: string[];
  flaggedAsInstruction: number;
};

export type ImportResult = {
  type: ImportType;
  imported: number;
  skipped: number;
  created: number;
  updated: number;
  linked: number;
  expectations: number;
  events: number;
  autoCreated: { customers: number; suppliers: number };
  errors: ImportIssue[];
};

export function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function detectImportType(headers: string[], fileName = ""): ImportType {
  const normalized = headers.map(normalizeHeader);
  const name = normalizeHeader(fileName);
  for (const type of ["invoice", "order", "product", "supplier", "customer"] as ImportType[]) {
    if (TYPE_HINTS[type].test(name)) return type;
  }
  if (normalized.some((h) => /invoice/.test(h))) return "invoice";
  if (normalized.some((h) => /^order|order_(id|number|no)$/.test(h)) && normalized.some((h) => /amount|total|value/.test(h))) return "order";
  if (normalized.some((h) => /^sku$|stock|inventory/.test(h))) return "product";
  if (normalized.some((h) => /supplier|vendor/.test(h))) return "supplier";
  return "customer";
}

function mapHeaders(type: ImportType, headers: string[]) {
  const normalized = headers.map(normalizeHeader);
  const used = new Set<number>();
  const mapping: Record<string, string | null> = {};
  const index: Record<string, number> = {};
  for (const field of FIELDS[type]) {
    let found = -1;
    for (const alias of field.aliases) {
      found = normalized.findIndex((h, i) => h === alias && !used.has(i));
      if (found >= 0) break;
    }
    if (found >= 0) {
      used.add(found);
      mapping[field.key] = headers[found];
      index[field.key] = found;
    } else {
      mapping[field.key] = null;
    }
  }
  const unmapped = headers.filter((_, i) => !used.has(i));
  return { mapping, index, unmapped };
}

export function parseAmount(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  if (!/\d/.test(text) || /[a-z]{2,}/i.test(text.replace(/^[a-z]{3}\s*|\s*[a-z]{2,3}$/gi, ""))) return null;
  let clean = text.replace(/[^\d.,-]/g, "");
  if (/,\d{1,2}$/.test(clean) && !/\.\d/.test(clean)) clean = clean.replace(/\./g, "").replace(",", ".");
  else clean = clean.replace(/,/g, "");
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

export function parseDate(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text}T17:00:00Z`;
  const dmy = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T17:00:00Z`;
    return Number.isNaN(Date.parse(iso)) ? null : iso;
  }
  const t = Date.parse(text);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "x"
  );
}

export function importedEntityId(type: ImportType, ref: string): string {
  return `ent_imp_${type}_${slug(ref)}`;
}

function analyse(type: ImportType, table: Tabular, fileName: string): ImportPreview & { all: ImportRow[] } {
  const { mapping, index, unmapped } = mapHeaders(type, table.headers);
  const errors: ImportIssue[] = [];
  const warnings: string[] = [];
  const rows: ImportRow[] = [];
  const seen = new Map<string, number>();
  const invalidRows = new Set<number>();
  for (const field of FIELDS[type]) {
    if (field.required && mapping[field.key] === null) {
      errors.push({ row: 0, field: field.key, message: `No column for required field "${field.key}".` });
    }
  }
  table.rows.forEach((cells, i) => {
    const rowNo = i + 2; // 1-based, header is row 1
    const values: Record<string, string | number | null> = {};
    let flagged = false;
    for (const field of FIELDS[type]) {
      const at = index[field.key];
      const raw = at === undefined ? "" : String(cells[at] ?? "").trim();
      if (raw && looksLikeInstruction(raw)) flagged = true;
      if (field.kind === "number") {
        const n = parseAmount(raw);
        if (raw && n === null) {
          errors.push({ row: rowNo, field: field.key, message: `"${boundedText(raw, 40)}" is not a number.` });
          invalidRows.add(rowNo);
        }
        if (n !== null && n < 0) {
          errors.push({ row: rowNo, field: field.key, message: "Negative amounts are not allowed." });
          invalidRows.add(rowNo);
        }
        values[field.key] = n;
      } else if (field.kind === "date") {
        const d = parseDate(raw);
        if (raw && !d) {
          errors.push({ row: rowNo, field: field.key, message: `"${boundedText(raw, 40)}" is not a date.` });
          invalidRows.add(rowNo);
        }
        values[field.key] = d;
      } else {
        values[field.key] = raw ? boundedText(raw, 300) : null;
      }
      if (field.required && (values[field.key] === null || values[field.key] === "")) {
        errors.push({ row: rowNo, field: field.key, message: `Missing ${field.key}.` });
        invalidRows.add(rowNo);
      }
    }
    if (!values.ref && values.name) values.ref = String(values.name);
    if (!values.name && values.ref) values.name = type === "order" ? `Order ${values.ref}` : type === "invoice" ? `Invoice ${values.ref}` : String(values.ref);
    const key = String(values.ref || "").toLowerCase();
    if (key) {
      if (seen.has(key)) {
        errors.push({ row: rowNo, field: "ref", message: `Duplicate of row ${seen.get(key)}.` });
        invalidRows.add(rowNo);
      } else seen.set(key, rowNo);
    }
    rows.push({ row: rowNo, values, flagged });
  });
  const flaggedCount = rows.filter((r) => r.flagged).length;
  if (flaggedCount) {
    warnings.push(
      `${flaggedCount} row(s) contain text that reads like an instruction. It will be stored as data only and never acted on.`,
    );
  }
  if ((type === "order" || type === "invoice") && mapping.dueAt === null) {
    warnings.push("No due date column: Pulse can record these but cannot watch their deadlines.");
  }
  const headerMissing = errors.some((e) => e.row === 0);
  const valid = headerMissing ? 0 : rows.filter((r) => !invalidRows.has(r.row)).length;
  return {
    type,
    fileName,
    headers: table.headers,
    mapping,
    unmapped,
    total: rows.length,
    valid,
    invalid: rows.length - valid,
    rows: rows.slice(0, 25),
    all: headerMissing ? [] : rows.filter((r) => !invalidRows.has(r.row)),
    errors: errors.slice(0, 100),
    warnings,
    flaggedAsInstruction: flaggedCount,
  };
}

export type ImportInput = { fileName: string; bytes: Buffer; type?: string };

function resolveType(input: ImportInput, table: Tabular): ImportType {
  if (input.type && (IMPORT_TYPES as readonly string[]).includes(input.type)) return input.type as ImportType;
  return detectImportType(table.headers, input.fileName);
}

/** Parse + map + validate. Never writes. */
export async function previewImport(input: ImportInput): Promise<ImportPreview> {
  const table = await readTabular({ name: input.fileName, bytes: input.bytes });
  const { all: _all, ...preview } = analyse(resolveType(input, table), table, input.fileName);
  void _all;
  return preview;
}

const CLOSED_ORDER = /^(delivered|complete|completed|closed|cancel+ed|fulfilled|shipped)$/i;
const PAID = /^(paid|settled|closed|complete|completed)$/i;

/**
 * Write validated rows into the SAME tables the engines read: entities, graph_nodes/edges, events,
 * expectations. Open orders and unpaid invoices with a due date become expectations, so Detect /
 * Pulse watch them with the existing clock — no new engine.
 */
export async function commitImport(
  db: DatabaseSync,
  input: ImportInput & { skipInvalid?: boolean },
  now: string,
  actor = "operator",
): Promise<ImportResult> {
  const table = await readTabular({ name: input.fileName, bytes: input.bytes });
  const type = resolveType(input, table);
  const analysed = analyse(type, table, input.fileName);
  if (analysed.errors.some((e) => e.row === 0)) {
    throw new Error(analysed.errors.find((e) => e.row === 0)!.message);
  }
  if (analysed.invalid > 0 && !input.skipInvalid) {
    throw new Error(`${analysed.invalid} row(s) failed validation. Fix them or import valid rows only.`);
  }
  const graph = graphFor(db);
  const events = eventsFor(db);
  const result: ImportResult = {
    type,
    imported: 0,
    skipped: analysed.invalid,
    created: 0,
    updated: 0,
    linked: 0,
    expectations: 0,
    events: 0,
    autoCreated: { customers: 0, suppliers: 0 },
    errors: analysed.errors,
  };

  const upsertEntity = (entityType: string, entityId: string, name: string, payload: Record<string, unknown>) => {
    const existing = one<{ payload: string }>(db, "SELECT payload FROM entities WHERE id = ?", [entityId]);
    const merged = { ...(existing ? (JSON.parse(existing.payload) as Record<string, unknown>) : {}), ...payload, ...UNTRUSTED_MARKER, source: "csv-import" };
    run(
      db,
      `INSERT INTO entities (id, type, name, payload, created_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, payload = excluded.payload`,
      [entityId, entityType, name, JSON.stringify(merged), now],
    );
    graph.upsertNode({ id: entityId, type: entityType, entity_id: entityId, label: name, metadata: { ...merged, name } });
    if (existing) result.updated += 1;
    else result.created += 1;
  };

  const findByRefOrName = (entityType: "customer" | "supplier" | "order" | "product", raw: string): string | undefined => {
    const byId = importedEntityId(entityType, raw);
    if (one(db, "SELECT id FROM entities WHERE id = ?", [byId])) return byId;
    const byName = one<{ id: string }>(db, "SELECT id FROM entities WHERE type = ? AND lower(name) = lower(?) LIMIT 1", [entityType, raw]);
    if (byName) return byName.id;
    if (entityType === "product") {
      const bySku = all<{ id: string; payload: string }>(db, "SELECT id, payload FROM entities WHERE type = 'product'").find((row) => {
        try {
          return String((JSON.parse(row.payload) as { sku?: string }).sku || "").toLowerCase() === raw.toLowerCase();
        } catch {
          return false;
        }
      });
      if (bySku) return bySku.id;
    }
    return undefined;
  };

  const ensureParty = (entityType: "customer" | "supplier", raw: string): string => {
    const found = findByRefOrName(entityType, raw);
    if (found) return found;
    const entityId = importedEntityId(entityType, raw);
    upsertEntity(entityType, entityId, boundedText(raw, 200), { autoCreated: true });
    if (entityType === "customer") result.autoCreated.customers += 1;
    else result.autoCreated.suppliers += 1;
    return entityId;
  };

  const edge = (from: string, to: string, relationship: string) => {
    graph.upsertEdge({ id: `ge_imp_${slug(from)}_${relationship}_${slug(to)}`.slice(0, 180), source_node_id: from, target_node_id: to, relationship, confidence: 1 });
    result.linked += 1;
  };

  const event = (eventType: string, entityType: string, entityId: string, sourceId: string, payload: Record<string, unknown>, occurredAt = now) => {
    events.append({
      type: eventType,
      source: "csv-import",
      source_id: sourceId,
      actor_id: actor,
      entity_type: entityType,
      entity_id: entityId,
      payload: { ...payload, ...UNTRUSTED_MARKER },
      occurred_at: occurredAt,
      received_at: now,
      confidence: 1,
      metadata: { connector: "csv-import", file: boundedText(input.fileName, 120) },
      idempotent: true,
    });
    result.events += 1;
  };

  const watch = (expId: string, entityId: string, description: string, dueAt: string, expected: string) => {
    const existing = one<{ status: string }>(db, "SELECT status FROM expectations WHERE id = ?", [expId]);
    if (existing && (existing.status === "FULFILLED" || existing.status === "CANCELLED")) return;
    upsertExpectation(db, {
      id: expId,
      description,
      due_at: dueAt,
      expected_at: dueAt,
      status: (existing?.status as never) || "ON_TRACK",
      created_at: now,
      updated_at: now,
      type: "event",
      entity_id: entityId,
      expected_event: expected,
      source_type: "connector",
      source_id: entityId,
      confidence: 1,
      condition: { connector: "csv-import" },
    });
    result.expectations += 1;
  };

  runWithDb(db, () => {
  db.exec("BEGIN");
  try {
    for (const row of analysed.all) {
      const v = row.values;
      const ref = String(v.ref);
      const name = String(v.name || ref);
      const entityId = importedEntityId(type, ref);
      const flags = row.flagged ? { flaggedAsInstruction: true } : {};
      if (type === "customer" || type === "supplier") {
        upsertEntity(type, entityId, name, { ref, email: v.email, phone: v.phone, city: v.city, country: v.country, role: v.role, ...flags });
        event(`${type}.imported`, type, entityId, `csv:${type}:${ref}`, { name });
      } else if (type === "product") {
        upsertEntity("product", entityId, name, { sku: ref, inventory: v.inventory, price: v.price, ...flags });
        if (v.supplier) edge(ensureParty("supplier", String(v.supplier)), entityId, "supplies");
        event("product.imported", "product", entityId, `csv:product:${ref}`, { name, sku: ref });
      } else if (type === "order") {
        const currency = String(v.currency || "DZD").toUpperCase();
        const status = String(v.status || "open").toLowerCase();
        const customerId = v.customer ? ensureParty("customer", String(v.customer)) : undefined;
        const customerName = customerId ? one<{ name: string }>(db, "SELECT name FROM entities WHERE id = ?", [customerId])?.name : undefined;
        upsertEntity("order", entityId, name === `Order ${ref}` && customerName ? `Order ${ref} — ${customerName}` : name, {
          ref,
          amount: v.amount,
          currency,
          dueAt: v.dueAt,
          status,
          customerId,
          ...flags,
        });
        if (customerId) edge(entityId, customerId, "belongs_to");
        if (v.product) {
          const productId = findByRefOrName("product", String(v.product));
          if (productId) edge(productId, entityId, "required_by");
        }
        event(EVENT_TYPES.ORDER_CREATED, "order", entityId, `csv:order:${ref}`, { name, amount: v.amount, currency, customerId });
        if (CLOSED_ORDER.test(status)) {
          event(EVENT_TYPES.ORDER_DELIVERED, "order", entityId, `csv:order:${ref}:delivered`, { status });
        } else if (v.dueAt) {
          watch(`exp_imp_order_${slug(ref)}`, entityId, `${name} delivered${customerName ? ` to ${customerName}` : ""}`, String(v.dueAt), EVENT_TYPES.ORDER_DELIVERED);
        }
      } else if (type === "invoice") {
        const currency = String(v.currency || "DZD").toUpperCase();
        const status = String(v.status || (v.paidAt ? "paid" : "open")).toLowerCase();
        const customerId = v.customer ? ensureParty("customer", String(v.customer)) : undefined;
        const orderId = v.order ? findByRefOrName("order", String(v.order)) : undefined;
        const customerName = customerId ? one<{ name: string }>(db, "SELECT name FROM entities WHERE id = ?", [customerId])?.name : undefined;
        upsertEntity("invoice", entityId, name, { ref, amount: v.amount, currency, dueAt: v.dueAt, status, customerId, orderId, paidAt: v.paidAt, ...flags });
        if (orderId) edge(orderId, entityId, "produces");
        if (customerId) edge(entityId, customerId, "billed_to");
        event(EVENT_TYPES.PAYMENT_EXPECTED, "invoice", entityId, `csv:invoice:${ref}`, { name, amount: v.amount, currency, dueAt: v.dueAt, customerId });
        if (PAID.test(status) || v.paidAt) {
          event(EVENT_TYPES.PAYMENT_RECEIVED, "invoice", entityId, `csv:invoice:${ref}:paid`, { amount: v.amount, currency }, String(v.paidAt || now));
        } else if (v.dueAt) {
          const amount = typeof v.amount === "number" ? v.amount.toLocaleString("en-US") : "";
          watch(
            `exp_imp_invoice_${slug(ref)}`,
            entityId,
            `Payment for ${name}${amount ? ` (${amount} ${currency})` : ""}${customerName ? ` from ${customerName}` : ""}`,
            String(v.dueAt),
            EVENT_TYPES.PAYMENT_RECEIVED,
          );
        }
      }
      result.imported += 1;
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  });
  audit(db, actor, "connector.import", "connector", "csv-import", {
    type,
    file: boundedText(input.fileName, 120),
    imported: result.imported,
    skipped: result.skipped,
  });
  return result;
}
