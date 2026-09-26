import "server-only";

import { isSafeNextPath } from "@/lib/auth/post-auth-destination";
import { readRequestCookieJar } from "@/lib/auth/silent-sign-in/cookie-jar-edge";
import { resolvePublicOriginUrl } from "@/lib/bff/public-origin-url.server";
import { readBidSessionId } from "@/lib/bff/session-cookie.server";
import {
  createSilentSignInCookieSpec,
  evaluateSilentSignInCookieGate,
} from "@auction/identity-rp/silent-sign-in";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { BID_SILENT_SSO_COOKIE_PREFIX } from "./config";

export function redirectIfSilentProbeBlocked(
  request: NextRequest,
  nextPath: string,
): NextResponse | null {
  const safePath = isSafeNextPath(nextPath) ? nextPath : "/dashboard";
  if (readBidSessionId(request)) {
    return NextResponse.redirect(resolvePublicOriginUrl(safePath), 302);
  }
  const gate = evaluateSilentSignInCookieGate({
    hasProductSession: false,
    cookieJar: readRequestCookieJar(request),
    cookieNames: createSilentSignInCookieSpec(BID_SILENT_SSO_COOKIE_PREFIX),
  });
  if (!gate.allowed) {
    return NextResponse.redirect(resolvePublicOriginUrl(safePath), 302);
  }
  return null;
}
