import "server-only";

import type { NextRequest, NextResponse } from "next/server";
import { LOGIN_TTL_SECONDS, SESSION_TTL_SECONDS } from "./session-store.server";

export function bidSessionCookieUsesSecureTransport(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "production" && env.ALLOW_HTTP_COOKIES !== "true";
}

export const BID_SESSION_COOKIE_NAME = bidSessionCookieUsesSecureTransport()
  ? "__Host-lax-bid-session"
  : "lax-bid-session";

export function readBidSessionId(request: NextRequest): string | null {
  const value = request.cookies.get(BID_SESSION_COOKIE_NAME)?.value;
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}

export function setBidSessionCookie(
  response: NextResponse,
  id: string,
  phase: "login" | "authenticated",
): void {
  response.cookies.set(BID_SESSION_COOKIE_NAME, id, {
    httpOnly: true,
    secure: bidSessionCookieUsesSecureTransport(),
    sameSite: "lax",
    path: "/",
    maxAge: phase === "login" ? LOGIN_TTL_SECONDS : SESSION_TTL_SECONDS,
  });
}

export function clearBidSessionCookie(response: NextResponse): void {
  response.cookies.set(BID_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: bidSessionCookieUsesSecureTransport(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
