import { NextResponse } from "next/server";

/** Browsers request /favicon.ico directly; serve the generated app icon instead of a 404. */
export function GET(req: Request) {
  return NextResponse.redirect(new URL("/icon", req.url), 308);
}
