import { type NextRequest, NextResponse } from "next/server";
import { safeReturnTo } from "./lib/safe-return-to";
import { SHOP_ADMIN_SESSION_COOKIE } from "./lib/session-cookie";

export function middleware(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const returnPath = `${pathname}${search}`;

  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/health/") ||
    pathname === "/login" ||
    pathname.startsWith("/_next/")
  ) {
    return NextResponse.next();
  }

  if (!request.cookies.get(SHOP_ADMIN_SESSION_COOKIE)?.value) {
    const login = new URL("/api/auth/login", request.url);
    login.searchParams.set("returnTo", safeReturnTo(returnPath));
    return NextResponse.redirect(login);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-shop-admin-pathname", returnPath);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
