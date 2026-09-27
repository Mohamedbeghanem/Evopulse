import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/types";

const PROTECTED = [
  "/onboarding",
  "/pulse",
  "/approvals",
  "/notifications",
  "/settings",
  "/profile",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const needsAuth = PROTECTED.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (!needsAuth) return NextResponse.next();
  if (req.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();
  const login = new URL("/login", req.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/onboarding/:path*", "/pulse", "/approvals/:path*", "/notifications/:path*", "/settings/:path*", "/profile/:path*"],
};
