"use client";

import { useState } from "react";
import { Button } from "@/components/ui/primitives";

type Preview = {
  type: string;
  fileName: string;
  headers: string[];
  mapping: Record<string, string | null>;
  unmapped: string[];
  total: number;
  valid: number;
  invalid: number;
  rows: { row: number; values: Record<string, string | number | null>; flagged: boolean }[];
  errors: { row: number; field: string; message: string }[];
  warnings: string[];
};

type Result = { type: string; imported: number; skipped: number; expectations: number; linked: number };

const TYPES = [
  { id: "", label: "Detect automatically" },
  { id: "customer", label: "Customers" },
  { id: "supplier", label: "Suppliers" },
  { id: "product", label: "Products" },
  { id: "order", label: "Orders" },
  { id: "invoice", label: "Invoices" },
];

const SAMPLES = ["customers", "suppliers", "products", "orders", "invoices"];

export function ImportPanel({ onImported, compact = false }: { onImported?: (result: Result) => void; compact?: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(path: string, skipInvalid = false) {
    if (!file) return null;
    const form = new FormData();
    form.set("file", file);
    if (type) form.set("type", type);
    if (skipInvalid) form.set("skipInvalid", "true");
    const res = await fetch(path, { method: "POST", body: form });
    const data = (await res.json().catch(() => ({}))) as { error?: string; preview?: Preview; result?: Result };
    if (!res.ok) throw new Error(data.error || "Import failed.");
    return data;
  }

  async function runPreview() {
    setBusy(true);
    setError(null);
    try {
      const data = await send("/api/connectors/import/preview");
      setPreview(data?.preview || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed.");
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    setBusy(true);
    setError(null);
    try {
      const data = await send("/api/connectors/import/commit", Boolean(preview && preview.invalid > 0));
      if (data?.result) {
        setResults((prev) => [data.result as Result, ...prev]);
        onImported?.(data.result);
      }
      setPreview(null);
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  const columns = preview ? Object.entries(preview.mapping).filter(([, header]) => header) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-[220px] flex-1 text-sm text-sand">
          File (.csv or .xlsx, up to 5 MB)
          <input
            aria-label="Import file"
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="mt-1 block w-full rounded-md border border-hairline bg-ink-800 px-3 py-2 text-sm text-paper file:mr-3 file:rounded file:border-0 file:bg-ink-600 file:px-3 file:py-1 file:text-paper"
            onChange={(event) => {
              setFile(event.target.files?.[0] || null);
              setPreview(null);
            }}
          />
        </label>
        <label className="block text-sm text-sand">
          Records
          <select
            aria-label="Record type"
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              setPreview(null);
            }}
            className="mt-1 block min-h-[42px] rounded-md border border-hairline bg-ink-800 px-3 text-sm text-paper"
          >
            {TYPES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <Button variant="ghost" disabled={!file || busy} onClick={() => void runPreview()}>
          Preview
        </Button>
      </div>
      {!compact ? (
        <p className="text-xs text-mute">
          Samples:{" "}
          {SAMPLES.map((name, index) => (
            <span key={name}>
              <a className="text-sand underline hover:text-paper" href={`/samples/${name}.csv`} download>
                {name}.csv
              </a>
              {index < SAMPLES.length - 1 ? " · " : ""}
            </span>
          ))}
          . Import customers first, then orders, then invoices so links resolve.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-miss">
          {error}
        </p>
      ) : null}
      {preview ? (
        <div className="rounded-md border border-hairline p-3" data-testid="import-preview">
          <p className="text-sm text-paper">
            {preview.fileName}: <span className="font-mono">{preview.type}</span> · {preview.total} rows ·{" "}
            <span className="text-ok">{preview.valid} valid</span>
            {preview.invalid ? <span className="text-miss"> · {preview.invalid} invalid</span> : null}
          </p>
          <p className="mt-1 text-xs text-mute">
            Mapped: {columns.map(([field, header]) => `${header} → ${field}`).join(", ") || "nothing"}
            {preview.unmapped.length ? ` · ignored: ${preview.unmapped.join(", ")}` : ""}
          </p>
          {preview.warnings.map((warning) => (
            <p key={warning} className="mt-1 text-xs text-need">
              {warning}
            </p>
          ))}
          {preview.errors.length ? (
            <ul className="mt-2 max-h-28 overflow-auto text-xs text-miss">
              {preview.errors.slice(0, 12).map((issue, index) => (
                <li key={`${issue.row}-${issue.field}-${index}`}>
                  {issue.row ? `Row ${issue.row}` : "Header"} · {issue.field}: {issue.message}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-mute">
                <tr>
                  <th className="py-1 pr-3 font-normal">Row</th>
                  {columns.map(([field]) => (
                    <th key={field} className="py-1 pr-3 font-normal">
                      {field}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, compact ? 5 : 10).map((row) => (
                  <tr key={row.row} className="border-t border-hairline text-sand">
                    <td className="py-1 pr-3 font-mono">{row.row}</td>
                    {columns.map(([field]) => (
                      <td key={field} className="max-w-[16rem] truncate py-1 pr-3">
                        {row.values[field] === null || row.values[field] === undefined ? "—" : String(row.values[field])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button disabled={busy || preview.valid === 0} onClick={() => void runImport()}>
              {preview.invalid ? `Import ${preview.valid} valid rows` : `Import ${preview.valid} rows`}
            </Button>
            <Button variant="quiet" disabled={busy} onClick={() => setPreview(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      {results.length ? (
        <ul className="space-y-1 text-sm" aria-live="polite">
          {results.map((result, index) => (
            <li key={index} className="text-ok">
              Imported {result.imported} {result.type} rows
              {result.skipped ? ` (${result.skipped} skipped)` : ""}
              {result.expectations ? ` · ${result.expectations} deadlines now watched by Pulse` : ""}.
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
