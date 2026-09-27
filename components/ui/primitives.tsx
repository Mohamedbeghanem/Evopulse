import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

const BUTTON: Record<string, string> = {
  primary: "border border-ink bg-ink text-card hover:border-ink-2 hover:bg-ink-2",
  attention: "border border-orange bg-orange text-white hover:border-[#c94e1c] hover:bg-[#c94e1c]",
  ghost: "border border-line bg-white text-ink hover:bg-cream",
  quiet: "border border-transparent bg-transparent text-muted hover:text-ink",
  danger: "border border-bad bg-white text-bad hover:bg-bad-bg",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON }) {
  return (
    <button
      className={`inline-flex min-h-[34px] items-center justify-center rounded-btn px-3 py-1.5 text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON[variant]} ${className}`}
      {...props}
    />
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`min-h-11 w-full rounded-btn border border-line bg-card px-4 py-2.5 text-ink caret-ink outline-none placeholder:text-muted focus:border-teal ${className}`}
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
    <div role="tablist" className="flex flex-wrap gap-1.5">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          type="button"
          aria-selected={tab.id === value}
          onClick={() => onChange(tab.id)}
          className={`min-h-8 rounded-pill border px-3 py-1 text-[12px] ${
            tab.id === value ? "border-ink bg-ink text-card" : "border-line bg-white text-ink hover:bg-cream"
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
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-btn bg-ink px-2 py-1 text-[11px] text-card group-hover:block group-focus-within:block"
      >
        {label}
      </span>
    </span>
  );
}
