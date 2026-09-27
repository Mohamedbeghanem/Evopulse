"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { PublicShell } from "@/components/public/PublicShell";
import { UserAppShell } from "@/components/user/UserAppShell";
import type { PublicUser, PublicWorkspace, SessionMode } from "@/lib/auth/types";

const PUBLIC = new Set([
  "/welcome",
  "/product",
  "/how-it-works",
  "/security",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify",
]);

function isPublic(path: string) {
  return PUBLIC.has(path);
}

/** "/" is the hackathon Home (Create a company / Open demo company); "/demo" is its alias. Always the Control OS shell. */
function isDemo(path: string) {
  return path === "/" || path === "/demo" || path.startsWith("/demo/");
}

/** "/m" is the mobile PWA; it brings its own chrome (app/m/layout.tsx). */
function isMobile(path: string) {
  return path === "/m" || path.startsWith("/m/");
}

function isOnboarding(path: string) {
  return path.startsWith("/onboarding");
}

export function ProductChrome({
  children,
  mode,
  user,
  workspace,
  workspaceMode = "entry",
}: {
  children: ReactNode;
  mode: SessionMode | "anon";
  user: PublicUser | null;
  workspace: PublicWorkspace | null;
  workspaceMode?: "entry" | "running";
}) {
  const path = usePathname() || "/";

  if (isMobile(path)) {
    return <>{children}</>;
  }
  if (isPublic(path)) {
    return <PublicShell>{children}</PublicShell>;
  }
  if (isOnboarding(path)) {
    return <OnboardingShell>{children}</OnboardingShell>;
  }
  if (mode === "user" && user && workspace && !isDemo(path)) {
    return (
      <UserAppShell user={user} workspace={workspace}>
        {children}
      </UserAppShell>
    );
  }
  return <AppShell workspaceMode={workspaceMode}>{children}</AppShell>;
}
