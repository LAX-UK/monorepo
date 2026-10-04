import { type NextRequest, NextResponse } from "next/server";
import { SHOP_ADMIN_SESSION_COOKIE } from "./lib/session-cookie";

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/health/") ||
    pathname === "/login" ||
    pathname.startsWith("/_next/")
  ) {
    return NextResponse.next();
  }
  if (!request.cookies.get(SHOP_ADMIN_SESSION_COOKIE)?.value) {
    const login = new URL("/login", request.url);
    login.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
