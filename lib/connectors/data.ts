/**
 * Everything a connector ingests (CSV cells, email bodies, WhatsApp texts, MCP tool output) is
 * BUSINESS DATA. It is stored verbatim (bounded), tagged untrusted, and flagged when it looks like an
 * instruction — it is never executed, never routed as a command, never allowed to change policy.
 */
const INJECTION = [
  /ignore .{0,80}(policy|policies|rules|instructions|evopulse|previous)/i,
  /disregard (your|all|the) (rules|policy|policies|instructions)/i,
  /you are now/i,
  /execute all (discounts|payments|actions)/i,
  /approve (all|every|this) (actions?|payments?|discounts?)/i,
  /(system|developer) prompt/i,
  /\b(rm -rf|drop table|delete from)\b/i,
];

export function looksLikeInstruction(text: string): boolean {
  return INJECTION.some((pattern) => pattern.test(text));
}

export function boundedText(value: unknown, max = 500): string {
  const text = value === null || value === undefined ? "" : String(value);
  // Strip control chars except newline/tab; keep the content itself as-is (it is data).
  const clean = text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

export const UNTRUSTED_MARKER = { untrusted: true, contentRole: "business_data" } as const;
