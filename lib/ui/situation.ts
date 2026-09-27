import type { AttentionItem } from "@/lib/attention";
import type { SituationRowModel } from "@/components/ui/rows";

/** UI adapter only. Canonical attention stays in lib/attention. */
export function situationRowFromAttention(item: AttentionItem): SituationRowModel {
  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    status: item.classification,
    layers: item.layers.map((layer) => layer.kind),
    money:
      item.impact.associatedRevenue != null
        ? { amount: item.impact.associatedRevenue, currency: item.impact.currency }
        : null,
    cashTiming:
      item.impact.expectedCash != null ? { amount: item.impact.expectedCash, currency: item.impact.currency } : null,
  };
}

export function situationHref(item: AttentionItem): string {
  const exceptionId = item.sourceExceptionId;
  if (exceptionId) return `/situations/${exceptionId}`;
  return item.href;
}
