"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Icon } from "@/components/icons";
import { AgentAvatar, agentShowsActivity, agentStatusLabel, type AgentAvatarState } from "@/components/agent/AgentAvatar";
import {
  BUILT_IN_AGENTS,
  CAPABILITY_OPTIONS,
  PREVIEW_STORAGE_KEY,
  SCOPE_OPTIONS,
  type AgentRecord,
} from "@/components/agent/catalog";

const CREATION_LINES = [
  "Creating agent...",
  "Connecting business scope...",
  "Loading governed tools...",
  "Applying policies...",
  "Starting monitoring...",
];

function readPreview(): AgentRecord[] {
  try {
    const raw = sessionStorage.getItem(PREVIEW_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AgentRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function BotsNav({ onNavigate }: { onNavigate: () => void }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const [preview, setPreview] = useState<AgentRecord[]>([]);

  useEffect(() => {
    setPreview(readPreview());
  }, []);

  const agents = [...BUILT_IN_AGENTS, ...preview];
  const visible = more ? agents : agents.slice(0, 3);

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between px-2.5 pb-1.5">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-side-label">Bots</p>
        <button
          type="button"
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-side-text hover:bg-side-hover"
          aria-label="Create agent"
          onClick={() => setOpen(true)}
        >
          <Icon name="plus" size={14} />
        </button>
      </div>
      <ul className="flex flex-col">
        {visible.map((agent) => {
          const href = `/agents/${agent.id}`;
          const active = path === href;
          const state: AgentAvatarState = agent.standing === "MONITORING" ? "MONITORING" : "IDLE";
          const status = agentStatusLabel(state);
          return (
            <li key={agent.id}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                title={agentShowsActivity(state) ? status : agent.name}
                className={`motion-safe flex min-h-9 items-center gap-2 rounded-md px-2 text-[13px] ${
                  active ? "bg-side-active text-[#F7F8F5]" : "text-side-text hover:bg-side-hover hover:text-[#F7F8F5]"
                }`}
              >
                <AgentAvatar agent={agent} state={state} size="sm" />
                <span className="min-w-0 flex-1 truncate">{agent.name}</span>
                {agentShowsActivity(state) ? (
                  <span className="inline-flex items-center gap-1 text-[10px] text-side-muted">
                    <span className="sr-only">{status}</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-[#C4A15A]" aria-hidden />
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
      {agents.length > 3 ? (
        <button
          type="button"
          className="px-2.5 py-1.5 text-[12px] text-side-muted hover:text-[#F7F8F5]"
          aria-expanded={more}
          onClick={() => setMore((value) => !value)}
        >
          {more ? "Show less" : "Show more"}
        </button>
      ) : null}
      {open ? (
        <CreateAgentSheet
          onClose={() => setOpen(false)}
          onCreated={(agent) => {
            const next = [...readPreview().filter((item) => item.id !== agent.id), agent];
            sessionStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(next));
            setPreview(next);
            setMore(true);
            setOpen(false);
            onNavigate();
          }}
        />
      ) : null}
    </div>
  );
}

function CreateAgentSheet({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (agent: AgentRecord) => void;
}) {
  const router = useRouter();
  const titleId = useId();
  const [name, setName] = useState("Revenue Guardian");
  const [purpose, setPurpose] = useState("Protect revenue and customer commitments.");
  const [scope, setScope] = useState<string[]>(["Customers", "Orders", "Invoices", "Commitments"]);
  const [capabilities, setCapabilities] = useState<string[]>(["Monitor", "Investigate", "Prepare actions"]);
  const [phase, setPhase] = useState<"form" | "running" | "done">("form");
  const [line, setLine] = useState(0);
  const [avatarState, setAvatarState] = useState<AgentAvatarState>("IDLE");

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (phase !== "running") return;
    const started = performance.now();
    const timer = window.setInterval(() => {
      const elapsed = performance.now() - started;
      setLine(Math.min(CREATION_LINES.length - 1, Math.floor(elapsed / 400)));
      if (elapsed < 700) setAvatarState("THINKING");
      else if (elapsed < 1400) setAvatarState("MONITORING");
      else setAvatarState("IDLE");
      if (elapsed >= 2000) {
        window.clearInterval(timer);
        setPhase("done");
        setAvatarState("IDLE");
      }
    }, 80);
    return () => window.clearInterval(timer);
  }, [phase]);

  function toggle(list: string[], value: string, set: (next: string[]) => void) {
    set(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  function create() {
    const trimmed = name.trim();
    if (!trimmed || phase !== "form") return;
    setPhase("running");
    setAvatarState("THINKING");
  }

  function finish() {
    const id = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const agent: AgentRecord = {
      id: id || "agent",
      name: name.trim(),
      purpose: purpose.trim(),
      tone: "slate",
      scope,
      capabilities,
      standing: "IDLE",
      preview: true,
    };
    onCreated(agent);
    router.push(`/agents/${agent.id}`);
  }

  const draft = { name: name.trim() || "New agent", tone: "slate" as const };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-3 sm:items-center" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-md overflow-auto rounded-[14px] border border-line bg-card p-5 text-ink shadow-[0_12px_40px_rgba(13,27,36,0.16)]"
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-warn">Demo configuration preview</p>
        <h2 id={titleId} className="mt-2 text-[22px] font-semibold tracking-tight">
          Create agent
        </h2>
        <p className="mt-1 text-[14px] text-muted">Give EvoPulse a focused responsibility in your business.</p>
        <p className="mt-2 text-[12px] text-muted">
          This preview is kept in this browser session only. It does not change policy, tools, or the live business.
        </p>

        {phase === "form" ? (
          <form
            className="mt-4 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              create();
            }}
          >
            <label className="block text-[13px]">
              <span className="font-medium">Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1 w-full rounded-md border border-line bg-cream px-3 py-2 text-[14px] outline-none focus:border-teal"
              />
            </label>
            <label className="block text-[13px]">
              <span className="font-medium">Purpose</span>
              <textarea
                value={purpose}
                rows={2}
                onChange={(event) => setPurpose(event.target.value)}
                className="mt-1 w-full resize-none rounded-md border border-line bg-cream px-3 py-2 text-[14px] outline-none focus:border-teal"
              />
            </label>
            <fieldset>
              <legend className="text-[13px] font-medium">Scope</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {SCOPE_OPTIONS.map((option) => (
                  <label key={option} className="inline-flex items-center gap-1.5 text-[13px]">
                    <input
                      type="checkbox"
                      checked={scope.includes(option)}
                      onChange={() => toggle(scope, option, setScope)}
                    />
                    {option}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-[13px] font-medium">Capabilities</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {CAPABILITY_OPTIONS.map((option) => (
                  <label key={option} className="inline-flex items-center gap-1.5 text-[13px]">
                    <input
                      type="checkbox"
                      checked={capabilities.includes(option)}
                      onChange={() => toggle(capabilities, option, setCapabilities)}
                    />
                    {option}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex items-start gap-2 text-[13px] text-muted">
              <input type="checkbox" checked disabled className="mt-0.5" />
              <span>
                Require approval for consequential actions. Always on. Policy still blocks anything outside its rules,
                including discounts above 5% and external messages.
              </span>
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-[13px] text-muted">
                Cancel
              </button>
              <button type="submit" className="rounded-md bg-ink px-3 py-2 text-[13px] font-medium text-card">
                Create agent
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-5">
            <AgentAvatar agent={draft} state={avatarState} size="lg" label />
            <p className="mt-4 text-[15px]" role="status">
              {phase === "done" ? `${draft.name} is active.` : CREATION_LINES[line]}
            </p>
            {phase === "done" ? (
              <button type="button" onClick={finish} className="mt-4 rounded-md bg-ink px-3 py-2 text-[13px] font-medium text-card">
                Open workspace
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
