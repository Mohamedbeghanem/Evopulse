"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { PublicShell } from "@/components/public/PublicShell";
import { UserAppShell } from "@/components/user/UserAppShell";
import type { PublicUser, PublicWorkspace, SessionMode } from "@/lib/auth/types";

const PUBLIC = new Set([
  "/",
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

function isOnboarding(path: string) {
  return path.startsWith("/onboarding");
}

export function ProductChrome({
  children,
  mode,
  user,
  workspace,
}: {
  children: ReactNode;
  mode: SessionMode | "anon";
  user: PublicUser | null;
  workspace: PublicWorkspace | null;
}) {
  const path = usePathname() || "/";

  if (isPublic(path)) {
    return <PublicShell>{children}</PublicShell>;
  }
  if (isOnboarding(path)) {
    return <OnboardingShell>{children}</OnboardingShell>;
  }
  if (mode === "user" && user && workspace && !path.startsWith("/demo")) {
    return (
      <UserAppShell user={user} workspace={workspace}>
        {children}
      </UserAppShell>
    );
  }
  return <AppShell>{children}</AppShell>;
}
