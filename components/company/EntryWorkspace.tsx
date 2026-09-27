"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PulseAvatar } from "@/components/pulse/PulseAvatar";
import { Button } from "@/components/ui/primitives";
import {
  COMPANY_TEMPLATES,
  CREATE_COMPANY_PREFILL,
  GENERATION_STEPS,
  type CompanyTemplateId,
  type PulseAvatarState,
} from "@/lib/company";

type Surface = "home" | "create" | "generating";

export function EntryWorkspace() {
  const router = useRouter();
  const [surface, setSurface] = useState<Surface>("home");
  const [prompt, setPrompt] = useState(CREATE_COMPANY_PREFILL);
  const [template, setTemplate] = useState<CompanyTemplateId>("distribution");
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const selected = useMemo(() => COMPANY_TEMPLATES.find((item) => item.id === template), [template]);

  async function openDemo() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/company/demo", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not open demo company");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setBusy(false);
    }
  }

  async function create() {
    if (selected?.depth === "demo") {
      setError(`${selected.label} is a demo template. Use Distribution for the live simulation.`);
      return;
    }
    setBusy(true);
    setError(null);
    setSurface("generating");
    setStep(0);
    setDone(false);
    const started = Date.now();
    const tick = window.setInterval(() => {
      setStep((current) => Math.min(current + 1, GENERATION_STEPS.length - 1));
    }, 320);
    try {
      const res = await fetch("/api/company/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, template }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create company");
      const elapsed = Date.now() - started;
      const wait = Math.max(0, 2400 - elapsed);
      await new Promise((resolve) => window.setTimeout(resolve, wait));
      window.clearInterval(tick);
      setStep(GENERATION_STEPS.length - 1);
      setDone(true);
      await new Promise((resolve) => window.setTimeout(resolve, 700));
      router.refresh();
    } catch (err) {
      window.clearInterval(tick);
      setError(err instanceof Error ? err.message : "Failed");
      setSurface("create");
      setBusy(false);
    }
  }

  const avatarState: PulseAvatarState = done ? "SUCCESS" : surface === "generating" ? (step < 2 ? "THINKING" : "INVESTIGATING") : "IDLE";

  if (surface === "generating") {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 text-center">
        <PulseAvatar state={avatarState} size="lg" caption={done ? "Running" : "Building your business..."} />
        <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.22em] text-mute">Business simulation</p>
        <h1 className="mt-3 text-[32px] leading-tight tracking-tight text-paper">
          {done ? "Atlas Medical Distribution is running." : GENERATION_STEPS[step]}
        </h1>
        <ol className="mt-8 w-full space-y-2 text-left">
          {GENERATION_STEPS.map((label, index) => (
            <li
              key={label}
              className={`font-mono text-[12px] ${index <= step ? "text-paper" : "text-mute"}`}
            >
              {index < step || done ? "●" : index === step ? "○" : "·"} {label}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  if (surface === "create") {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col justify-center px-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute">Create a company</p>
        <h1 className="mt-4 text-[32px] leading-tight tracking-tight text-paper sm:text-[40px]">
          Describe the company you want to run.
        </h1>
        <label className="sr-only" htmlFor="company-prompt">
          Company description
        </label>
        <textarea
          id="company-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={5}
          className="mt-8 w-full rounded-md border border-hairline bg-ink-800 px-4 py-4 text-paper outline-none focus:border-need"
        />
        <div className="mt-5 flex flex-wrap gap-2">
          {COMPANY_TEMPLATES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTemplate(item.id);
                if (item.depth === "full") setPrompt(item.suggestion);
                setError(null);
              }}
              className={`rounded-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] ${
                template === item.id ? "bg-ink-600 text-paper" : "border border-hairline text-sand hover:text-paper"
              }`}
            >
              {item.label}
              {item.depth === "demo" ? " · demo" : ""}
            </button>
          ))}
        </div>
        {selected?.depth === "demo" ? (
          <p className="mt-4 text-sm text-watch">
            {selected.label} is a demo template. Only Distribution has a live Control OS simulation.
          </p>
        ) : null}
        {error ? <p className="mt-4 text-sm text-miss">{error}</p> : null}
        <div className="mt-8 flex flex-wrap gap-3">
          <Button type="button" variant="attention" disabled={busy} onClick={() => void create()}>
            Create company
          </Button>
          <Button type="button" variant="quiet" disabled={busy} onClick={() => setSurface("home")}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-4 text-center">
      <PulseAvatar state="IDLE" size="lg" caption="Ready" />
      <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.22em] text-mute">EvoPulse</p>
      <h1 className="mt-4 text-[36px] leading-tight tracking-tight text-paper sm:text-[48px]">
        What would you like to do?
      </h1>
      <p className="mt-4 max-w-md text-sand">Create a company. EvoPulse immediately understands, monitors and operates it.</p>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Button type="button" variant="attention" disabled={busy} onClick={() => setSurface("create")}>
          + Create a company
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={() => void openDemo()}>
          {busy ? "Opening…" : "Open demo company"}
        </Button>
      </div>
      {error ? <p className="mt-6 text-sm text-miss">{error}</p> : null}
    </div>
  );
}
