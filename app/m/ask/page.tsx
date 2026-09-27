import { MobileAsk } from "@/components/mobile/MobileAsk";

export const dynamic = "force-dynamic";

export default async function MobileAskPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return (
    <div className="space-y-5">
      <header className="pt-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">EvoPulse</p>
        <h1 className="mt-1 font-serif text-[32px] leading-tight">Ask</h1>
        <p className="mt-2 text-sm text-sand">Answers come from the live business graph. Asking never approves anything.</p>
      </header>
      <MobileAsk initial={typeof q === "string" ? q.slice(0, 300) : ""} />
    </div>
  );
}
