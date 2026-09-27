import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { calculateGraphImpact, explainWhyAffected } from "@/lib/engine/impact";
import { IDS } from "@/lib/ids";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const origin = id === IDS.excDelay || id === IDS.shipment ? IDS.shipment : id;
  const impact = calculateGraphImpact(getDb(), origin);
  return NextResponse.json({
    exceptionId: id,
    origin,
    impact,
    whyOrderB: explainWhyAffected(getDb(), IDS.shipment, IDS.orderB),
  });
}