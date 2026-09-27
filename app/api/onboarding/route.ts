import { NextResponse } from "next/server";
import { authErrorResponse, requireUserContext } from "@/lib/auth";
import { runWithDb } from "@/lib/db";
import { DiscoveryService } from "@/lib/discovery/service";
import { OnboardingService } from "@/lib/onboarding/service";

export async function POST(req: Request) {
  try {
    const ctx = await requireUserContext();
    const body = (await req.json()) as Record<string, unknown>;
    const step = String(body.step || "");
    return runWithDb(ctx.db, () => {
      if (step === "business") {
        const workspace = OnboardingService.saveBusiness(ctx.workspace!.id, {
          name: String(body.name || ""),
          industry: String(body.industry || ""),
          teamSize: String(body.teamSize || ""),
          country: String(body.country || ""),
          currency: String(body.currency || "USD"),
        });
        return NextResponse.json({ workspace, next: "/onboarding/protect" });
      }
      if (step === "protect") {
        const workspace = OnboardingService.saveProtections(ctx.workspace!.id, (body.protections as string[]) || []);
        return NextResponse.json({ workspace, next: "/onboarding/meet" });
      }
      if (step === "connect") {
        return NextResponse.json({ next: "/onboarding/discovery" });
      }
      if (step === "discovery") {
        const facts = OnboardingService.runDiscovery(ctx.workspace!.id, ctx.db);
        return NextResponse.json({ facts, next: "/onboarding/review" });
      }
      if (step === "review") {
        const corrections = (body.corrections as { kind: string; count: number }[]) || [];
        for (const item of corrections) DiscoveryService.correct(ctx.workspace!.id, item.kind, item.count);
        return NextResponse.json({ next: "/onboarding/goal" });
      }
      if (step === "goal") {
        const goal = OnboardingService.setFirstGoal(ctx.workspace!.id, ctx.db, String(body.protection || "operations"));
        return NextResponse.json({ goal, next: "/onboarding/first-pulse" });
      }
      if (step === "finish") {
        const workspace = OnboardingService.finish(ctx.workspace!.id);
        return NextResponse.json({ workspace, next: "/pulse" });
      }
      return NextResponse.json({ error: "Unknown onboarding step." }, { status: 400 });
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
