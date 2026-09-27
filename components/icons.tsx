import type { JSX } from "react";

export type IconName =
  | "pulse"
  | "command"
  | "timeline"
  | "business"
  | "goals"
  | "control"
  | "settings"
  | "search"
  | "plus"
  | "approval"
  | "blocked"
  | "monitoring"
  | "verified"
  | "simulation"
  | "evidence"
  | "graph"
  | "action"
  | "demo";

const GLYPH: Record<IconName, JSX.Element> = {
  pulse: <path d="M3 12h3.4l2.3-5.4 3.5 10.8L15 12H21" />,
  command: (
    <path d="M6 6.5h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9.2L5.5 19.4V16.5H6a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z" />
  ),
  timeline: (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 8.2V12l2.8 1.8" />
    </>
  ),
  business: (
    <>
      <path d="M6.2 20.5V5.6h11.6v14.9" />
      <path d="M4.5 20.5h15" />
      <path d="M10 20.5v-3.2h4V20.5" />
      <path d="M9 8.6h1.6M13.4 8.6H15M9 12h1.6M13.4 12H15" />
    </>
  ),
  goals: (
    <>
      <circle cx="12" cy="12" r="7.4" />
      <circle cx="12" cy="12" r="3.6" />
      <circle cx="12" cy="12" r="0.8" />
    </>
  ),
  control: <path d="M12 3.4 19.6 6.6v5.1c0 4.3-3.1 7-7.6 8.9-4.5-1.9-7.6-4.6-7.6-8.9V6.6z" />,
  settings: (
    <>
      <path d="M9.7 3.7h4.6l.55 2.05c.55.22 1.05.52 1.5.88l1.95-.78 2.25 3.9-1.55 1.35c.1.5.16.98.16 1.5s-.06 1-.16 1.5l1.55 1.35-2.25 3.9-1.95-.78c-.45.36-.95.66-1.5.88l-.55 2.05H9.7l-.55-2.05a6 6 0 0 1-1.5-.88l-1.95.78-2.25-3.9 1.55-1.35a6 6 0 0 1 0-3l-1.55-1.35 2.25-3.9 1.95.78c.45-.36.95-.66 1.5-.88z" />
      <circle cx="12" cy="12" r="2.3" />
    </>
  ),
  search: (
    <>
      <circle cx="10.6" cy="10.6" r="5.8" />
      <path d="M15 15.1 20.2 20.3" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  approval: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.2 19.2c.45-2.9 2.55-4.5 5.8-4.5 1.55 0 2.9.4 3.95 1.15" />
      <path d="M13.2 16.1 15.5 18.4 20.2 13" />
    </>
  ),
  blocked: (
    <>
      <rect x="5.5" y="10.6" width="13" height="8.8" rx="1.6" />
      <path d="M8.2 10.6V8.3a3.8 3.8 0 0 1 7.6 0v2.3" />
    </>
  ),
  monitoring: (
    <>
      <path d="M2.8 12S6.6 6.7 12 6.7 21.2 12 21.2 12 17.4 17.3 12 17.3 2.8 12 2.8 12z" />
      <circle cx="12" cy="12" r="2.3" />
    </>
  ),
  verified: <path d="M5 12.5 9.7 17.2 19 7.2" />,
  simulation: (
    <>
      <circle cx="6" cy="5" r="2" />
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="7" r="2" />
      <path d="M6 7v10" />
      <path d="M6 11.4c3.2-4 6.6-4.4 10-4.4" />
    </>
  ),
  evidence: (
    <>
      <path d="M7 3.5h7.1L18.5 8v12.5H7z" />
      <path d="M14.1 3.6V8H18.4" />
      <path d="M10 12.6h5M10 15.8h3.4" />
    </>
  ),
  graph: (
    <>
      <path d="M8 8.3 15.9 7.3M7.4 9.7 8.6 15.5M16.5 8.8 16.3 14M9.6 17.2 15 16.2M8.5 9.5 15.2 14.6" />
      <circle cx="6" cy="8" r="2.1" />
      <circle cx="18" cy="7" r="2.1" />
      <circle cx="8" cy="17.5" r="2.1" />
      <circle cx="17" cy="16" r="2.1" />
    </>
  ),
  action: <path d="M13.2 3.2 7.2 12.4h4.4L10.4 20.8 17.6 10.2h-4.5z" />,
  demo: (
    <>
      <path d="M4 7h2.5M11.5 7H20" />
      <circle cx="9" cy="7" r="2.15" />
      <path d="M4 12h8.6M17.4 12H20" />
      <circle cx="15" cy="12" r="2.15" />
      <path d="M4 17h1.6M10.4 17H20" />
      <circle cx="8" cy="17" r="2.15" />
    </>
  ),
};

export function Icon({
  name,
  size = 18,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ? `shrink-0 ${className}` : "shrink-0"}
    >
      {GLYPH[name]}
    </svg>
  );
}
