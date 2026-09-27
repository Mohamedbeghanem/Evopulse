import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Instrument_Serif } from "next/font/google";
import { ProductChrome } from "@/components/session/ProductChrome";
import { resolveRequestContext } from "@/lib/auth";
import { workspaceMode } from "@/lib/company";
import { getDb } from "@/lib/db";
import { toPlain } from "@/lib/plain";
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

// The shell reads workspace mode (entry vs running) and the session, so no route may be prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "EvoPulse — Nothing falls through",
  description: "Your business is running. EvoPulse makes sure nothing falls through.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const ctx = await resolveRequestContext();
  return (
    <html lang="en">
      <body className={`${serif.variable} ${sans.variable} ${mono.variable} font-sans antialiased`}>
        <ProductChrome
          mode={ctx.user ? ctx.mode : "anon"}
          user={toPlain(ctx.user)}
          workspace={toPlain(ctx.workspace)}
          workspaceMode={workspaceMode(getDb())}
        >
          {children}
        </ProductChrome>
      </body>
    </html>
  );
}
