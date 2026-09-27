import { connection } from "next/server";
import { getDb, getMeta } from "@/lib/db";
import { CANNED_PROMPTS } from "@/lib/prompts";
import { demoStamp } from "@/lib/ui/format";
import type { NavItem } from "@/lib/ui/nav";
import { DemoBar } from "./DemoBar";
import { Rail, type RailItem } from "./os/Rail";
import { TopBar } from "./os/TopBar";

/** The four design screens. ACT points at goals until the /actions screen lands. */
const NAV: RailItem[] = [
  { href: "/", label: "Business Twin", short: "Twin", icon: "twin" },
  { href: "/explore", label: "Causal Explorer", short: "Cause", icon: "cause", match: ["/impact"] },
  { href: "/timeline", label: "Time Machine", short: "Time", icon: "time" },
  { href: "/goals", label: "Goal → Action", short: "Act", icon: "act", match: ["/exceptions"] },
];

/** Everything else lives behind "More". */
const MORE: NavItem[] = [
  { href: "/simulate", label: "Simulate" },
  { href: "/command", label: "Command" },
  { href: "/graph", label: "Graph" },
  { href: "/autonomy", label: "Autonomy" },
];

export async function AppShell({ children }: { children: React.ReactNode }) {
  // The demo clock lives in the database, so the shell is always rendered per request.
  await connection();
  return (
    <div className="flex min-h-screen bg-os-bg text-fg">
      <Rail items={NAV} more={MORE} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar demoStamp={readDemoStamp()} askPlaceholder={`Ask your business… e.g. ${CANNED_PROMPTS[0]}`} />
        <DemoBar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-8 sm:px-6 md:pb-8">{children}</main>
      </div>
    </div>
  );
}

function readDemoStamp(): string {
  try {
    const db = getDb();
    return demoStamp(getMeta(db, "demo_now"));
  } catch {
    return "";
  }
}
