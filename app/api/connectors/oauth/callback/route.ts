import { NextResponse } from "next/server";
import { publicOrigin, withConnectors } from "@/lib/connectors/http";

export const dynamic = "force-dynamic";

/**
 * OAuth 2.1 redirect target. The signed-in admin's workspace DB holds the one-time state
 * (PKCE verifier sealed). Codes and tokens never appear in the redirect or the logs.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = publicOrigin(req);
  const state = url.searchParams.get("state") || "";
  const code = url.searchParams.get("code") || "";
  const providerError = url.searchParams.get("error");
  if (providerError || !state || !code) {
    return NextResponse.redirect(`${origin}/connectors?oauth=${encodeURIComponent(providerError ? "denied" : "invalid")}`, 303);
  }
  const res = await withConnectors("admin", async ({ service }) => {
    const out = await service.completeOAuth(state, code);
    return NextResponse.redirect(`${origin}/connectors/${encodeURIComponent(out.installId)}?oauth=${out.test.ok ? "connected" : "error"}`, 303);
  });
  if (res.status >= 400) return NextResponse.redirect(`${origin}/connectors?oauth=failed`, 303);
  return res;
}
