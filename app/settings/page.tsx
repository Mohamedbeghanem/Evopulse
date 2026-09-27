import { Workspace } from "@/components/shell/Workspace";
import Link from "next/link";

const LINKS = [
  { href: "/autonomy", label: "Autonomy" },
  { href: "/learning", label: "Learning" },
];

export default function SettingsPage() {
  return (
    <Workspace mode="focused">
      <div className="bg-cream text-ink">
        <h1 className="text-[22px] font-semibold leading-[1.2] tracking-[-0.02em]">Settings</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">These are the existing autonomy and learning records.</p>
        <ul className="mt-6 flex max-w-md flex-col gap-2">
          {LINKS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block rounded-card border border-line bg-card px-4 py-3 text-[15px] font-semibold text-ink hover:bg-cream"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Workspace>
  );
}
