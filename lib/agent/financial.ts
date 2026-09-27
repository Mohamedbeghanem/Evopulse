const FORBIDDEN_MONEY_CLAIMS = [
  { pattern: /\blost revenue\b/gi, replacement: "associated revenue" },
  { pattern: /\brevenue lost\b/gi, replacement: "associated revenue" },
  { pattern: /\bguaranteed loss\b/gi, replacement: "associated exposure" },
  { pattern: /\brevenue saved\b/gi, replacement: "associated revenue addressed" },
  { pattern: /\bmoney (is )?lost\b/gi, replacement: "associated revenue is at risk — not lost" },
  { pattern: /\bcash lost\b/gi, replacement: "expected cash timing" },
];

export function constrainFinancialLanguage(text: string): string {
  let next = text;
  for (const rule of FORBIDDEN_MONEY_CLAIMS) {
    next = next.replace(rule.pattern, rule.replacement);
  }
  return next;
}

export function assertsCanonicalMoneyLabels(payload: unknown): { associatedRevenue?: number; expectedCashTiming?: number } {
  if (!payload || typeof payload !== "object") return {};
  const record = payload as Record<string, unknown>;
  const associatedRevenue =
    numberish(record.associatedRevenue) ??
    numberish(record.associated_revenue) ??
    numberish(record.associatedValue);
  const expectedCashTiming =
    numberish(record.expectedCashTiming) ??
    numberish(record.affected_expected_cash) ??
    numberish(record.expected_cash_timing);
  return { associatedRevenue, expectedCashTiming };
}

function numberish(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}
