import "server-only";

import type { NextRequest, NextResponse } from "next/server";
import { LOGIN_TTL_SECONDS, SESSION_TTL_SECONDS } from "./session-store.server";

export function bidSessionCookieUsesSecureTransport(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "production" && env.ALLOW_HTTP_COOKIES !== "true";
}

/** Names used across HTTP dev/E2E and HTTPS production (`__Host-` prefix). */
export const BID_SESSION_COOKIE_NAMES = ["lax-bid-session", "__Host-lax-bid-session"] as const;

export function getBidSessionCookieName(env: NodeJS.ProcessEnv = process.env): string {
  return bidSessionCookieUsesSecureTransport(env) ? "__Host-lax-bid-session" : "lax-bid-session";
}

export function readBidSessionId(request: NextRequest): string | null {
  const value = request.cookies.get(getBidSessionCookieName())?.value;
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
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
