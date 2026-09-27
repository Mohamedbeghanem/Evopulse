import Link from "next/link";
import { Aside, btn, EmptyNote, Metric, PageTitle, Pill, Screen, SectionTitle } from "@/components/pulse/attend";
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
    <Screen className="flex min-h-0">
      <div className="min-w-0 max-w-[920px] flex-1 px-4 py-6 lg:px-8">
        <PageTitle title="What can run without me?">
          <p>
            {attention.summary.needsYou} need you · {attention.summary.needsApproval} need approval ·{" "}
            {attention.summary.blocked} blocked · {attention.summary.autoHandled} auto-handled (not resolved) ·{" "}
            {attention.summary.handled} handled after verification SUCCESS.
          </p>
        </PageTitle>
        <p className="mt-3">
          <Link href="/policy" className="text-sm text-[#0F4C5C] underline underline-offset-4">
            Policies
          </Link>
        </p>

        <div className="mt-6 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="AUTO" value={String(autoHandled.length + prepared.length + monitoring.length)} caption="Safe / watching. Not HANDLED." />
          <Metric label="APPROVAL" value={String(approval.length)} caption="Human gate. 320K send stays here." />
          <Metric label="BLOCKED" value={String(blocked.length)} caption="discount_max=5% refused 10%." />
          <Metric label="HANDLED" value={String(handled.length)} caption="Verification SUCCESS only." />
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
      </div>
      <Aside title="Control loop">
        <p className="text-[#5C6B73]">AUTO · APPROVAL_REQUIRED · BLOCKED. Autopilot classifies. Policy determines permission.</p>
        <p className="text-[#5C6B73]">
          AUTO_HANDLED is not resolution. A safe internal action ran. The business outcome is still unverified.
        </p>
        <p className="text-[#5C6B73]">Verification SUCCESS is HANDLED. Executed, AUTO_HANDLED, and MONITORING are not.</p>
        <p className="text-[#5C6B73]">AI cannot approve itself. Policy is rechecked before every execution.</p>
      </Aside>
    </Screen>
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
    <section className="mt-9">
      <SectionTitle title={title} count={count} />
      {note ? <p className="mb-3 text-sm text-[#5C6B73]">{note}</p> : null}
      {items.length ? (
        <div className="space-y-2">
          {items.map((card) => (
            <AutopilotRow key={card.id} card={card} />
          ))}
        </div>
      ) : (
        <EmptyNote title={empty} body="One situation, one classification." />
      )}
    </section>
  );
}

function AutopilotRow({ card }: { card: AttentionItem }) {
  const policy = policyFace(card);
  const verification = verificationFace(card);
  const resolved = card.classification === "HANDLED";
  return (
    <article className="rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] p-4">
      <div className="flex flex-wrap gap-2">
        <Pill>{card.classification}</Pill>
        <Pill>{policy}</Pill>
        <Pill>{verification}</Pill>
        <Pill>{card.reasonCode}</Pill>
      </div>
      <h3 className="mt-3 text-[15px] font-semibold text-[#0D1B24]">{card.title}</h3>
      <p className="mt-1 text-sm text-[#5C6B73]">{card.summary}</p>
      <p className="mt-2 text-sm text-[#0D1B24]">{card.needsFromYou}</p>
      {card.classification === "AUTO_HANDLED" ? (
        <p className="mt-2 text-xs text-[#5C6B73]" role="status">
          AUTO_HANDLED is not resolution. Verification SUCCESS is HANDLED.
        </p>
      ) : null}
      {resolved ? (
        <p className="mt-2 text-xs text-[#1B7A4A]" role="status">
          Verification SUCCESS. The situation is HANDLED.
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={card.href} className={btn.ink}>
          Review situation
        </Link>
        {card.autopilotDecisionId ? (
          <Link href={`/autopilot/${card.autopilotDecisionId}`} className={btn.quiet}>
            Why this classification?
          </Link>
        ) : null}
      </div>
    </article>
  );
}
