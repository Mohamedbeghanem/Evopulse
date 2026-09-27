import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/Badge";
import { getDb } from "@/lib/db";
import { ExceptionAutopilotService } from "@/lib/autopilot";

export const dynamic = "force-dynamic";

export default async function AutopilotTracePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trace = ExceptionAutopilotService.for(getDb()).explain(id);
  if (!trace) notFound();

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-mute">Autopilot trace</p>
        <h1 className="mt-2 font-serif text-4xl sm:text-5xl">Why did EvoPulse do this?</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge>{trace.current}</Badge>
          <Badge>{trace.decision.reasonCode}</Badge>
        </div>
      </div>
      {[
        ["OBSERVED", trace.observed],
        ["DETECTED", trace.detected],
        ["IMPACT", trace.impact],
        ["PLAN", trace.plan],
        ["POLICY", trace.policy],
        ["AUTOPILOT", trace.autopilot],
        ["CURRENT", trace.current],
      ].map(([label, text]) => (
        <section key={label} className="rounded-2xl border border-white/10 p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-mute">{label}</p>
          <p className="mt-2 text-sand">{text}</p>
        </section>
      ))}
      {trace.historical ? (
        <section className="rounded-2xl border border-white/10 p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-mute">Historical context</p>
          <p className="mt-2 text-sand">{trace.historical}</p>
          <p className="mt-2 text-xs text-mute">History does not override policy.</p>
        </section>
      ) : null}
      <Link href="/" className="text-sm underline underline-offset-4">
        Back to Pulse
      </Link>
    </div>
  );
}
