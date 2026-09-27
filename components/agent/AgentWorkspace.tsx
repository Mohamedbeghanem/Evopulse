"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AgentAvatar, type AgentAvatarState } from "@/components/agent/AgentAvatar";
import { agentById, PREVIEW_STORAGE_KEY, type AgentRecord } from "@/components/agent/catalog";

type PulseContext = {
  company?: { name?: string } | null;
  counts?: { NEEDS_YOU?: number; MONITORING?: number; HANDLED?: number };
  attention?: {
    needsMe?: { id: string; title: string; summary?: string }[];
    watching?: { id: string; title: string }[];
    handled?: { id: string; title: string }[];
  };
};

export function AgentWorkspace({ id }: { id: string }) {
  const router = useRouter();
  const [agent, setAgent] = useState<AgentRecord | null | undefined>(undefined);
  const [pulse, setPulse] = useState<PulseContext | null>(null);
  const [ask, setAsk] = useState("");

  useEffect(() => {
    let extra: AgentRecord[] = [];
    try {
      const raw = sessionStorage.getItem(PREVIEW_STORAGE_KEY);
      extra = raw ? (JSON.parse(raw) as AgentRecord[]) : [];
    } catch {
      extra = [];
    }
    setAgent(agentById(id, extra) ?? null);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/pulse")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: PulseContext | null) => {
        if (!cancelled) setPulse(data);
      })
      .catch(() => {
        if (!cancelled) setPulse(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (agent === undefined) return null;
  if (!agent) {
    return (
      <div className="mx-auto max-w-[720px] px-6 py-10">
        <h1 className="text-[28px] font-semibold text-ink">Agent not in this session</h1>
        <p className="mt-2 text-[15px] text-muted">Preview agents live in this browser only. The built-in agents are still in the sidebar.</p>
        <Link href="/command" className="mt-4 inline-flex text-[14px] text-teal">
          Back to Command
        </Link>
      </div>
    );
  }

  const state: AgentAvatarState = agent.standing === "MONITORING" ? "MONITORING" : "IDLE";
  const needs = pulse?.counts?.NEEDS_YOU;
  const watching = pulse?.counts?.MONITORING;
  const handled = pulse?.counts?.HANDLED;
  const activity = [
    ...(pulse?.attention?.needsMe ?? []).map((item) => item.title),
    ...(pulse?.attention?.watching ?? []).slice(0, 3).map((item) => item.title),
  ];

  return (
    <div className="mx-auto max-w-[760px] px-6 py-8">
      {agent.preview ? (
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-warn">Demo configuration preview</p>
      ) : null}
      <div className="mt-3 flex items-center gap-4">
        <AgentAvatar agent={agent} state={state} size="lg" />
        <div>
          <h1 className="text-[30px] font-semibold tracking-tight text-ink">{agent.name}</h1>
          <p className="mt-1 text-[13px] font-medium text-muted">{state === "MONITORING" ? "Monitoring" : "Idle"}</p>
        </div>
      </div>
      <p className="mt-4 max-w-[62ch] text-[15px] text-ink-2">{agent.purpose}</p>
      <p className="mt-4 text-[13px] text-muted">
        Current scope
        <span className="mt-1 block text-[15px] text-ink">{agent.scope.join(" · ")}</span>
      </p>
      <section className="mt-8">
        <h2 className="text-[18px] font-semibold text-ink">Today</h2>
        <p className="mt-2 text-[14px] text-muted">{pulse?.company?.name || "This business"} from the live pulse.</p>
        <ul className="mt-3 space-y-1 text-[15px] text-ink">
          <li>{needs == null ? "Situations still loading" : `${needs} need you`}</li>
          <li>{watching == null ? "Monitoring still loading" : `${watching} monitoring`}</li>
          <li>{handled == null ? "Handled still loading" : `${handled} handled`}</li>
        </ul>
      </section>
      <section className="mt-8">
        <h2 className="text-[18px] font-semibold text-ink">Recent activity</h2>
        {activity.length ? (
          <ul className="mt-3 space-y-2 text-[15px] text-ink-2">
            {activity.map((title) => (
              <li key={title}>{title}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[15px] text-muted">No live situation titles yet. Ask from Command. Policy still decides what can run.</p>
        )}
      </section>
      <form
        className="mt-8"
        onSubmit={(event) => {
          event.preventDefault();
          const text = ask.trim();
          if (!text) return;
          router.push(`/command?ask=${encodeURIComponent(text)}`);
        }}
      >
        <label htmlFor="agent-ask" className="text-[13px] font-medium text-ink">
          Ask this agent
        </label>
        <p className="mt-1 text-[12px] text-muted">The question runs in Command, through the same governed runtime. This view does not approve or execute.</p>
        <div className="mt-2 flex gap-2">
          <input
            id="agent-ask"
            value={ask}
            onChange={(event) => setAsk(event.target.value)}
            placeholder="Ask this agent..."
            className="min-h-11 flex-1 rounded-md border border-line bg-card px-3 text-[15px] text-ink outline-none focus:border-teal"
          />
          <button type="submit" className="rounded-md bg-ink px-4 text-[14px] font-medium text-card">
            Ask
          </button>
        </div>
      </form>
    </div>
  );
}
