import Link from "next/link";
import { InspectorPanel } from "@/components/shell/InspectorPanel";
import { Workspace } from "@/components/shell/Workspace";
import { PolicyBadge, StatusBadge, VerificationBadge } from "@/components/ui/badges";
import { ActionBar, EmptyState, ImpactMetric, PageHeader, SectionHeader } from "@/components/ui/chrome";
import { projectAttention, type AttentionItem } from "@/lib/attention";
import { getDb, getMeta } from "@/lib/db";

export const dynamic = "force-dynamic";

const POLICY_BUCKET: Record<string, "AUTO" | "APPROVAL_REQUIRED" | "BLOCKED" | "NEEDS_YOU"> = {
  AUTO_HANDLED: "AUTO",
  PREPARED: "AUTO",
  MONITORING: "AUTO",
  HANDLED: "AUTO",
  NORMAL: "AUTO",
  NEEDS_APPROVAL: "APPROVAL_REQUIRED",
  BLOCKED: "BLOCKED",
  NEEDS_YOU: "NEEDS_YOU",
};

function policyFace(item: AttentionItem) {
  if (item.classification === "BLOCKED" || item.reasonCode === "POLICY_BLOCKED") return "BLOCKED";
  if (item.classification === "NEEDS_APPROVAL") return "APPROVAL_REQUIRED";
  if (item.classification === "NEEDS_YOU") return "NEEDS_YOU";
  if (item.classification === "HANDLED") return "AUTO";
  return POLICY_BUCKET[item.classification] || "AUTO";
}

function verificationFace(item: AttentionItem) {
  if (item.classification === "HANDLED" || item.reasonCode === "VERIFIED_RESOLVED") return "SUCCESS";
  if (item.reasonCode === "VERIFICATION_PENDING") return "PENDING";
  if (item.reasonCode === "VERIFICATION_FAILED") return "FAILED";
  if (item.classification === "AUTO_HANDLED") return "AUTO_HANDLED";
  return item.classification;
}

export default function AutopilotPage() {
  const db = getDb();
  const attention = projectAttention(db, getMeta(db, "demo_now"));
  const cards = [...attention.needsMe, ...attention.watching, ...attention.handled];
  const blocked = cards.filter((card) => policyFace(card) === "BLOCKED");
  const approval = cards.filter((card) => policyFace(card) === "APPROVAL_REQUIRED");
  const needsYou = cards.filter((card) => policyFace(card) === "NEEDS_YOU");
  const autoHandled = cards.filter((card) => card.classification === "AUTO_HANDLED");
  const monitoring = cards.filter((card) => card.classification === "MONITORING");
  const handled = cards.filter((card) => card.classification === "HANDLED");
  const prepared = cards.filter((card) => card.classification === "PREPARED" || card.classification === "NORMAL");

  return (
    <Workspace
      mode="operational"
      inspector={
        <InspectorPanel title="Control loop">
          <p>AUTO · APPROVAL_REQUIRED · BLOCKED. Autopilot classifies. Policy determines permission.</p>
          <p className="mt-3">
            AUTO_HANDLED is not resolution. A safe internal action ran. The business outcome is still unverified.
          </p>
          <p className="mt-3">Verification SUCCESS is HANDLED. Executed, AUTO_HANDLED, and MONITORING are not.</p>
          <p className="mt-3">AI cannot approve itself. Policy is rechecked before every execution.</p>
        </InspectorPanel>
      }
    >
      <PageHeader kicker="Autopilot · Control loop" title="What can run without me?">
        <p>
          {attention.summary.needsYou} need you · {attention.summary.needsApproval} need approval ·{" "}
          {attention.summary.blocked} blocked · {attention.summary.autoHandled} auto-handled (not resolved) ·{" "}
          {attention.summary.handled} handled after verification SUCCESS.
        </p>
      </PageHeader>

      <div className="mt-8 grid grid-cols-2 gap-3 max-w-2xl sm:grid-cols-4">
        <ImpactMetric label="AUTO" value={String(autoHandled.length + prepared.length + monitoring.length)} caption="Safe / watching. Not HANDLED." />
        <ImpactMetric label="APPROVAL" value={String(approval.length)} caption="Human gate. 320K send stays here." />
        <ImpactMetric label="BLOCKED" value={String(blocked.length)} caption="discount_max=5% refused 10%." />
        <ImpactMetric label="HANDLED" value={String(handled.length)} caption="Verification SUCCESS only." />
      </div>

      <Bucket
        title="Blocked by policy"
        count={blocked.length}
        empty="No policy blocks in the current loop."
        items={blocked}
        note="BLOCKED is successful governance. 10% cannot execute. Safe alternative may be 5% + Net-14 — still APPROVAL_REQUIRED."
      />
      <Bucket
        title="Needs approval"
        count={approval.length}
        empty="Nothing is waiting on a human authorization."
        items={approval}
        note="Canonical: the 320K recovery requires approval. AI cannot approve itself."
      />
      <Bucket
        title="Needs you"
        count={needsYou.length}
        empty="No high-impact tradeoff is waiting."
        items={needsYou}
      />
      <Bucket
        title="Auto-handled — not resolved"
        count={autoHandled.length}
        empty="No AUTO action has run."
        items={autoHandled}
        note="AUTO_HANDLED means a policy-AUTO internal action executed. It is not verification. It is not HANDLED."
      />
      <Bucket
        title="Monitoring"
        count={monitoring.length}
        empty="Nothing is waiting on verification."
        items={monitoring}
        note="Executed is not solved. VERIFICATION PENDING stays MONITORING until SUCCESS."
      />
      <Bucket
        title="Handled — verification SUCCESS"
        count={handled.length}
        empty="No situation is HANDLED yet. AUTO_HANDLED does not fill this list."
        items={handled}
        note="Only verification SUCCESS resolves a situation."
      />
    </Workspace>
  );
}

function Bucket({
  title,
  count,
  empty,
  items,
  note,
}: {
  title: string;
  count: number;
  empty: string;
  items: AttentionItem[];
  note?: string;
}) {
  return (
    <section className="mt-10 space-y-3">
      <SectionHeader title={title} count={count} />
      {note ? <p className="text-sm text-sand">{note}</p> : null}
      {items.length ? (
        items.map((card) => <AutopilotRow key={card.id} card={card} />)
      ) : (
        <EmptyState title={empty} body="One situation, one classification." />
      )}
    </section>
  );
}

function AutopilotRow({ card }: { card: AttentionItem }) {
  const policy = policyFace(card);
  const verification = verificationFace(card);
  const resolved = card.classification === "HANDLED";
  return (
    <article className="border-b border-hairline py-4">
      <div className="flex flex-wrap gap-3">
        <StatusBadge value={card.classification} />
        <PolicyBadge outcome={policy} />
        <VerificationBadge status={verification} />
        <StatusBadge value={card.reasonCode} />
      </div>
      <h2 className="mt-3 text-xl text-paper">{card.title}</h2>
      <p className="mt-2 text-sm text-sand">{card.summary}</p>
      <p className="mt-2 text-sm text-paper">{card.needsFromYou}</p>
      {card.classification === "AUTO_HANDLED" ? (
        <p className="mt-2 text-xs text-mute" role="status">
          AUTO_HANDLED is not resolution. Verification SUCCESS is HANDLED.
        </p>
      ) : null}
      {resolved ? (
        <p className="mt-2 text-xs text-ice" role="status">
          Verification SUCCESS. The situation is HANDLED.
        </p>
      ) : null}
      <div className="mt-4">
        <ActionBar>
          <Link href={card.href} className="inline-flex min-h-8 items-center rounded-md bg-paper px-4 py-2 text-sm font-medium text-ink-950">
            Review situation
          </Link>
          {card.autopilotDecisionId ? (
            <Link href={`/autopilot/${card.autopilotDecisionId}`} className="inline-flex min-h-8 items-center px-4 text-sm text-need">
              Why this classification?
            </Link>
          ) : null}
        </ActionBar>
      </div>
    </article>
  );
}
