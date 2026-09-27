import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { MobileNav } from "@/components/mobile/MobileNav";
import { RegisterServiceWorker } from "@/components/mobile/RegisterServiceWorker";

export const metadata: Metadata = {
  title: "EvoPulse",
  description: "What needs you — from the same engines as the desktop Pulse.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "EvoPulse", statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#07090c",
};

/** Mobile-first PWA shell. Rendered without the desktop chrome (see ProductChrome). */
export default function MobileLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col bg-ink-950 text-paper">
      <main id="m-main" className="flex-1 px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
        {children}
      </main>
      <MobileNav />
      <RegisterServiceWorker />
    </div>
  );
}
