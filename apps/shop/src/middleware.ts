import {
  SHOP_IDENTITY_FETCH_TIMEOUT_MS,
  SHOP_IDENTITY_SESSION_COOKIE,
  shopIdentityBaseUrl,
  shopIdentityServerUrl,
} from "@/lib/shop-identity.server";
import { SHOP_SILENT_SSO_COOKIE_PREFIX, isShopSilentSsoEnabled } from "@/lib/silent-sign-in/config";
import { readRequestCookieJar } from "@/lib/silent-sign-in/cookie-jar";
import {
  createSilentSignInCookieSpec,
  evaluateSilentSignInEligibility,
  selectSilentSignInStrategy,
} from "@auction/identity-rp";
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
    if (isShopSilentSsoEnabled()) {
      const strategy = selectSilentSignInStrategy({
        fedcmEnabled: process.env.FEDCM_ENABLED === "true",
      });
      if (strategy === "redirect") {
        const eligibility = evaluateSilentSignInEligibility({
          request: {
            method: request.method,
            pathname,
            getHeader: (name) => request.headers.get(name),
            userAgent: request.headers.get("user-agent"),
            hasProductSession: false,
          },
          cookieJar: readRequestCookieJar(request),
          cookieNames: createSilentSignInCookieSpec(SHOP_SILENT_SSO_COOKIE_PREFIX),
          skipPathPrefixes: SKIP_PREFIXES,
        });
        if (eligibility.kind === "probe") {
          const returnTo = `${pathname}${request.nextUrl.search}`;
          const probeUrl = new URL("/auth/sso-probe", shopIdentityBaseUrl());
          probeUrl.searchParams.set("returnTo", returnTo);
          return NextResponse.redirect(probeUrl);
        }
      }
    }
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
