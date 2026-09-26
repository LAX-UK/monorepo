import "server-only";

import type { NextRequest, NextResponse } from "next/server";
import {
  BID_SESSION_COOKIE_NAMES,
  bidSessionCookieUsesSecureTransport,
  getBidSessionCookieName,
  readBidSessionIdFromStore,
} from "./session-cookie.constants";
import { LOGIN_TTL_SECONDS, SESSION_TTL_SECONDS } from "./session-store.server";

export {
  BID_SESSION_COOKIE_NAMES,
  bidSessionCookieUsesSecureTransport,
  getBidSessionCookieName,
  isBidSessionId,
  parseBidSessionId,
  readBidSessionIdFromStore,
} from "./session-cookie.constants";

export function readBidSessionId(request: NextRequest): string | null {
  return readBidSessionIdFromStore(request.cookies);
}

export function setBidSessionCookie(
  response: NextResponse,
  id: string,
  phase: "login" | "authenticated",
): void {
  response.cookies.set(getBidSessionCookieName(), id, {
    httpOnly: true,
    secure: bidSessionCookieUsesSecureTransport(),
    sameSite: "lax",
    path: "/",
    maxAge: phase === "login" ? LOGIN_TTL_SECONDS : SESSION_TTL_SECONDS,
  });
}

export function clearBidSessionCookie(response: NextResponse): void {
  const secure = bidSessionCookieUsesSecureTransport();
  for (const name of BID_SESSION_COOKIE_NAMES) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
}
