import {
  buildRequestWithAuthEdgeHeader,
  getAuthPublicCookieRedirectUrl,
} from "@/lib/auth/auth-public-edge";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const tagged = buildRequestWithAuthEdgeHeader(request);
  if (tagged) {
    return NextResponse.next(tagged);
  }

  const redirectUrl = getAuthPublicCookieRedirectUrl(
    request.nextUrl,
    request.headers.get("cookie") ?? "",
  );
  if (redirectUrl) {
    return NextResponse.redirect(redirectUrl, 307);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/login/two-factor",
    "/register",
    "/dashboard",
    "/dashboard/:path*",
    "/admin",
    "/admin/:path*",
  ],
};
