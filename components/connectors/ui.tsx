"use client";

import {
  Blocks,
  CircleCheck,
  CreditCard,
  FileSpreadsheet,
  GitBranch,
  Inbox,
  KanbanSquare,
  ListChecks,
  Loader2,
  Mail,
  MessageCircle,
  NotebookText,
  Plug,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import type { ConfigField, ConnectorState, ConnectorView } from "@/lib/connectors/types";

const ICONS: Record<string, LucideIcon> = {
  Blocks,
  CircleCheck,
  CreditCard,
  FileSpreadsheet,
  GitBranch,
  Inbox,
  KanbanSquare,
  ListChecks,
  Mail,
  MessageCircle,
  NotebookText,
  Plug,
};

export type ChipState = ConnectorState | "loading";

const CHIP: Record<ChipState, { label: string; tone: string }> = {
  connected: { label: "Connected", tone: "text-ok border-ok/40" },
  needs_auth: { label: "Needs auth", tone: "text-need border-need/40" },
  needs_grant: { label: "Needs access grant", tone: "text-need border-need/40" },
  not_configured: { label: "Not configured", tone: "text-mute border-hairline" },
  error: { label: "Error", tone: "text-miss border-miss/40" },
  disabled: { label: "Disabled", tone: "text-sand border-hairline" },
  loading: { label: "Loading", tone: "text-sand border-hairline" },
};

export function StatusChip({ state }: { state: ChipState }) {
  const chip = CHIP[state];
  return (
    <span
      data-state={state}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${chip.tone}`}
    >
      {state === "loading" ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
      {chip.label}
    </span>
  );
}

export function ConnectorIcon({ icon, monogram, accent, size = 36 }: { icon?: string; monogram?: string; accent?: string; size?: number }) {
  const Icon = ICONS[icon || ""] || Plug;
  return (
    <span
      aria-hidden
      className="relative inline-flex shrink-0 items-center justify-center rounded-md border border-hairline bg-ink-800 text-paper"
      style={{ width: size, height: size }}
    >
      <Icon className="text-sand" style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={1.75} />
      {monogram ? (
        <span
          className="absolute -bottom-1 -right-1 rounded px-1 font-mono text-[9px] font-semibold leading-[14px] text-ink-950"
          style={{ background: accent || "#e6e6e6" }}
        >
          {monogram}
        </span>
      ) : null}
    </span>
  );
}

export async function call<T = Record<string, unknown>>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data;
}

export function when(iso: string | null | undefined) {
  if (!iso) return "never";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function applies(field: ConfigField, values: Record<string, string>) {
  if (!field.when) return true;
  const current = values[field.when.key] || "";
  if (field.when.in && !field.when.in.includes(current)) return false;
  if (field.when.notIn && field.when.notIn.includes(current)) return false;
  return true;
}

const inputClass =
  "mt-1 block min-h-[40px] w-full rounded-md border border-hairline bg-ink-800 px-3 text-sm text-paper outline-none placeholder:text-mute focus:border-need disabled:opacity-60";

/** Connect / configure form. Secrets are write-only: masked input, never prefilled, never echoed. */
export function ConnectForm({
  connector,
  canAdmin,
  onSaved,
  submitLabel = "Save",
}: {
  connector: ConnectorView;
  canAdmin: boolean;
  onSaved: (message: string) => void;
  submitLabel?: string;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);
  if (!connector.fields.length) return null;
  const effective: Record<string, string> = {};
  for (const field of connector.fields) {
    const current = connector.config[field.key];
    effective[field.key] = values[field.key] ?? (current !== undefined ? String(current) : "");
  }
  if (connector.connectorId === "mcp") {
    effective.transport ||= "auto";
    effective.authType ||= connector.authType === "api_key" ? "none" : connector.authType;
  }
  const fields = connector.fields.filter((field) => applies(field, effective) && (advanced || !field.advanced));
  const hasAdvanced = connector.fields.some((field) => field.advanced && applies(field, effective));
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await call(`/api/connectors/${connector.installId}`, { action: "configure", values });
          setValues({});
          onSaved("Saved. Secrets are encrypted at rest and never shown again.");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Save failed.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {fields.map((field) => {
        const secretState = connector.secrets[field.key];
        if (field.type === "select") {
          return (
            <label key={field.key} className="block text-sm text-sand">
              {field.label}
              <select
                name={field.key}
                disabled={!canAdmin}
                value={effective[field.key] || field.placeholder || ""}
                onChange={(event) => setValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
                className={inputClass}
              >
                {(field.options || []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          );
        }
        const placeholder =
          field.type === "secret"
            ? secretState === "set"
              ? "•••••• stored (leave blank to keep)"
              : secretState === "env"
                ? `from ${field.env}`
                : field.placeholder || (field.env ? `or set ${field.env}` : "")
            : field.placeholder || (field.env ? `or set ${field.env}` : "");
        return (
          <label key={field.key} className="block text-sm text-sand">
            {field.label}
            {field.required ? <span className="text-need"> *</span> : null}
            <input
              name={field.key}
              type={field.type === "secret" ? "password" : field.type === "number" ? "number" : "text"}
              autoComplete={field.type === "secret" ? "new-password" : "off"}
              spellCheck={false}
              disabled={!canAdmin}
              value={field.type === "secret" ? (values[field.key] ?? "") : effective[field.key]}
              placeholder={placeholder}
              onChange={(event) => setValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
              className={inputClass}
            />
          </label>
        );
      })}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" variant="ghost" disabled={busy || !canAdmin}>
          {busy ? "Saving…" : submitLabel}
        </Button>
        {hasAdvanced ? (
          <button type="button" className="text-xs text-sand underline" onClick={() => setAdvanced((v) => !v)}>
            {advanced ? "Hide advanced" : "Advanced"}
          </button>
        ) : null}
        {!canAdmin ? <span className="text-xs text-mute">Only workspace owners and admins can change connectors.</span> : null}
        {error ? (
          <span role="alert" className="text-xs text-miss">
            {error}
          </span>
        ) : null}
      </div>
    </form>
  );
}

export type PendingAction = { id: string; type: string; title: string; policy_outcome: string; policy_reason: string; status: string };

export function PendingApprovals({ pending, canDecide }: { pending: PendingAction[]; canDecide: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  if (!pending.length) return null;
  return (
    <section className="mt-8" aria-label="Connector actions waiting for approval">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">Plugin actions waiting for a human · {pending.length}</h2>
      <ul className="mt-3 space-y-2">
        {pending.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-hairline px-3 py-2">
            <div>
              <p className="text-sm text-paper">{item.title}</p>
              <p className="text-xs text-sand">
                {item.policy_outcome.replaceAll("_", " ")} · {item.policy_reason}
              </p>
            </div>
            {canDecide ? (
              <div className="flex gap-2">
                <Button
                  variant="attention"
                  onClick={async () => {
                    try {
                      await call(`/api/connectors/actions/${item.id}`, { decision: "approve" });
                      setMessage("Approved. Policy was rechecked and the call ran. Executed is not handled; verification follows.");
                    } catch (err) {
                      setMessage(err instanceof Error ? err.message : "Failed.");
                    }
                    router.refresh();
                  }}
                >
                  Approve
                </Button>
                <Button
                  variant="quiet"
                  onClick={async () => {
                    await call(`/api/connectors/actions/${item.id}`, { decision: "reject" }).catch(() => undefined);
                    router.refresh();
                  }}
                >
                  Reject
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {message ? <p className="mt-2 text-xs text-sand">{message}</p> : null}
    </section>
  );
}
