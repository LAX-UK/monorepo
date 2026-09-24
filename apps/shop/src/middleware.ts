import {
  SHOP_IDENTITY_FETCH_TIMEOUT_MS,
  SHOP_IDENTITY_SESSION_COOKIE,
  shopIdentityBaseUrl,
  shopIdentityServerUrl,
} from "@/lib/shop-identity.server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const SKIP_PREFIXES = [
  "/login",
  "/register",
  "/auth/",
  "/session-expired",
  "/account/disabled",
  "/api/",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SHOP_IDENTITY_SESSION_COOKIE)?.value;
  if (!sessionCookie) {
    return NextResponse.next();
  }

  try {
    const response = await fetch(shopIdentityServerUrl("/me"), {
      cache: "no-store",
      signal: AbortSignal.timeout(SHOP_IDENTITY_FETCH_TIMEOUT_MS),
      headers: {
        accept: "application/json",
        cookie: `${SHOP_IDENTITY_SESSION_COOKIE}=${sessionCookie}`,
      },
    });
    const body = (await response.json().catch(() => null)) as {
      tokenUpgradeRequired?: boolean;
    } | null;
    if (response.ok && body?.tokenUpgradeRequired) {
      const returnTo = `${pathname}${request.nextUrl.search}`;
      const upgradeUrl = new URL("/auth/upgrade", shopIdentityBaseUrl());
      upgradeUrl.searchParams.set("returnTo", returnTo);
      return NextResponse.redirect(upgradeUrl);
    }
  } catch {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
