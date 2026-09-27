/** Navigation helpers shared by the rail, the More menu and the top-bar breadcrumb. */

export type NavItem = {
  href: string;
  label: string;
  /** Extra path prefixes that also light this item up. */
  match?: string[];
};

/** "/" only matches itself; everything else matches its prefix at a segment boundary. */
export function isActive(path: string, item: NavItem): boolean {
  const prefixes = [item.href, ...(item.match ?? [])];
  return prefixes.some((prefix) => {
    if (prefix === "/") return path === "/";
    return path === prefix || path.startsWith(`${prefix}/`);
  });
}

const TITLES: [prefix: string, title: string][] = [
  ["/explore", "Causal Explorer"],
  ["/impact", "Impact"],
  ["/timeline", "Business Time Machine"],
  ["/goals", "Goal → Action"],
  ["/simulate", "Business Simulator"],
  ["/command", "Command"],
  ["/graph", "Business Graph"],
  ["/autonomy", "Autonomy"],
];

/** Breadcrumb title for the current path. */
export function screenTitle(path: string): string {
  if (path === "/") return "Business Twin";
  if (/^\/exceptions\/[^/]+\/plan\/?$/.test(path)) return "Recovery plan";
  if (path.startsWith("/exceptions")) return "Exception";
  const hit = TITLES.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  return hit ? hit[1] : "EvoPulse";
}
