import { readRequestCookieJar } from "@/lib/auth/silent-sign-in/cookie-jar-edge.js";
import { readBidSessionIdFromStore } from "@/lib/bff/session-cookie.server";
import {
  createSilentSignInCookieSpec,
  evaluateSilentSignInEligibility,
  selectSilentSignInStrategy,
} from "@auction/identity-rp";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  BID_SILENT_SSO_COOKIE_PREFIX,
  BID_SILENT_SSO_SKIP_PREFIXES,
  isBidSilentSsoEnabled,
} from "./config.js";

export function applySilentSignInEdge(request: NextRequest): NextResponse | null {
  if (!isBidSilentSsoEnabled()) {
    return null;
  }
  const strategy = selectSilentSignInStrategy({
    fedcmEnabled: process.env.FEDCM_ENABLED === "true",
  });
  if (strategy === "fedcm") {
    return null;
  }
  const hasProductSession = Boolean(readBidSessionIdFromStore(request.cookies));
  const eligibility = evaluateSilentSignInEligibility({
    request: {
      method: request.method,
      pathname: request.nextUrl.pathname,
      getHeader: (name) => request.headers.get(name),
      userAgent: request.headers.get("user-agent"),
      hasProductSession,
    },
    cookieJar: readRequestCookieJar(request),
    cookieNames: createSilentSignInCookieSpec(BID_SILENT_SSO_COOKIE_PREFIX),
    skipPathPrefixes: BID_SILENT_SSO_SKIP_PREFIXES,
  });
  if (eligibility.kind !== "probe") {
    return null;
  }
  const probeUrl = new URL("/api/auth/sso-probe", request.url);
  probeUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(probeUrl, 302);
}
