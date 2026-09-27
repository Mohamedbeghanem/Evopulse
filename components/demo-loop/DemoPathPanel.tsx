import Link from "next/link";
import type { DemoPathStep } from "@/lib/demo-loop/demo-path";

/** Lightweight 90-second demo path. Links existing screens; completion comes from engine state. */
export function DemoPathPanel({ steps, currentStepId }: { steps: DemoPathStep[]; currentStepId: string | null }) {
  const done = steps.filter((step) => step.done).length;
  return (
    <section className="mt-8 rounded-lg border border-hairline p-4" aria-label="Demo path" data-testid="demo-path">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">Demo path · 90 seconds</p>
        <p className="font-mono text-[11px] text-mute">
          {done}/{steps.length} done
        </p>
      </div>
      <ol className="mt-3 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-5">
        {steps.map((step, index) => {
          const current = step.id === currentStepId;
          return (
            <li key={step.id}>
              <Link
                href={step.href}
                title={step.hint}
                data-step={step.id}
                aria-current={current ? "step" : undefined}
                className={`flex h-full items-start gap-2 rounded-md border px-2.5 py-2 text-xs ${
                  current
                    ? "border-need text-paper"
                    : step.done
                      ? "border-hairline text-mute"
                      : "border-hairline text-sand hover:border-paper hover:text-paper"
                }`}
              >
                <span className={`font-mono ${step.done ? "text-ok" : current ? "text-need" : "text-mute"}`} aria-hidden>
                  {step.done ? "✓" : String(index + 1).padStart(2, "0")}
                </span>
                <span>
                  {step.label}
                  <span className="sr-only">{step.done ? " (done)" : current ? " (next)" : ""}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
