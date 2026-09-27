import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

const BUTTON: Record<string, string> = {
  primary: "bg-paper text-ink-950 hover:bg-need",
  attention: "bg-need text-ink-950 hover:bg-paper",
  ghost: "border border-white/15 text-paper hover:border-paper",
  quiet: "border border-white/10 text-sand hover:text-paper",
  danger: "border border-miss/40 text-miss hover:bg-miss/10",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON }) {
  return (
    <button
      className={`inline-flex min-h-8 items-center justify-center rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 ${BUTTON[variant]} ${className}`}
      {...props}
    />
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`min-h-11 w-full rounded-md border border-hairline bg-ink-800 px-4 py-2.5 text-paper outline-none focus:border-need ${className}`}
      {...props}
    />
  );
}

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          type="button"
          aria-selected={tab.id === value}
          onClick={() => onChange(tab.id)}
          className={`min-h-8 rounded-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] ${
            tab.id === value ? "bg-ink-600 text-paper" : "text-sand hover:text-paper"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-paper px-2 py-1 text-[11px] text-ink-950 group-hover:block group-focus-within:block"
      >
        {label}
      </span>
    </span>
  );
}
