import { NextResponse } from "next/server";
import { readUpload, withConnectors } from "@/lib/connectors/http";
import { toPlain } from "@/lib/plain";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return withConnectors("write", async ({ service }) => {
    const upload = await readUpload(req);
    return NextResponse.json({ preview: toPlain(await service.previewImport(upload)) });
  });
}
