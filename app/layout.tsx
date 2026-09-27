import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Instrument_Serif } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { workspaceMode } from "@/lib/company";
import { getDb } from "@/lib/db";
import "./globals.css";

const serif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-serif",
});

const sans = IBM_Plex_Sans({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-sans",
});

const mono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-mono",
});

// The shell reads workspace mode (entry vs running) from the database, so no route may be prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "EvoPulse — Nothing falls through",
  description: "AI-native Business Control System. Expected vs actual, with evidence.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${serif.variable} ${sans.variable} ${mono.variable} font-sans antialiased`}>
        <AppShell workspaceMode={workspaceMode(getDb())}>{children}</AppShell>
      </body>
    </html>
  );
}
