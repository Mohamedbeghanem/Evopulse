import { redirect } from "next/navigation";
import { requireUserContext, type RequestContext } from "../auth";

export async function requireOnboarding(): Promise<RequestContext & { user: NonNullable<RequestContext["user"]>; workspace: NonNullable<RequestContext["workspace"]> }> {
  try {
    const ctx = await requireUserContext();
    return ctx as RequestContext & { user: NonNullable<RequestContext["user"]>; workspace: NonNullable<RequestContext["workspace"]> };
  } catch {
    redirect("/login");
  }
}

export async function requireAppUser() {
  const ctx = await requireOnboarding();
  if (!ctx.workspace.onboardingCompleted) redirect("/onboarding");
  return ctx;
}
