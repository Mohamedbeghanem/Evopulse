import { NextResponse } from "next/server";
import { assertCanWrite, authErrorResponse, requireUserContext } from "@/lib/auth";
import { IntegrationService } from "@/lib/integrations/service";

export async function GET() {
  try {
    const ctx = await requireUserContext();
    return NextResponse.json({ connectors: IntegrationService.list(ctx.workspace!.id) });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireUserContext();
    assertCanWrite(ctx.role === "operator" ? "viewer" : ctx.role!);
    const body = (await req.json()) as { connectorId?: string };
    const connectors = IntegrationService.connect(ctx.workspace!.id, body.connectorId || "");
    return NextResponse.json({ connectors });
  } catch (error) {
    return authErrorResponse(error);
  }
}
