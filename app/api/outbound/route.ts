import { NextResponse } from "next/server";
import { withWorkspace } from "@/lib/auth";
import { outboundView } from "@/lib/outbound";

export const GET = withWorkspace(async (ctx) => NextResponse.json(outboundView(ctx.db)));
