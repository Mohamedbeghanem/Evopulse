import { NextResponse } from "next/server";
import { readUpload, withConnectors } from "@/lib/connectors/http";
import { toPlain } from "@/lib/plain";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return withConnectors("write", async ({ service, actor }) => {
    const upload = await readUpload(req);
    const result = await service.commitImport(upload, actor);
    return NextResponse.json({ result: toPlain(result), connector: toPlain(service.registry.view("csv-import")) });
  });
}
