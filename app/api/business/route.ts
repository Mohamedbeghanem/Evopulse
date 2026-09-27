import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/auth";
import { businessSnapshot } from "@/lib/business";

/** Read-only view of the seeded business (entities, graph, commitments, attention, agents). */
export const GET = withWorkspace(async (ctx) => NextResponse.json(businessSnapshot(ctx.db)));
