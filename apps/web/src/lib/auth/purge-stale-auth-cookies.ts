import { BID_SESSION_COOKIE_NAMES } from "@/lib/bff/session-cookie.constants";
import type { NextResponse } from "next/server";

/** @deprecated use {@link BID_SESSION_COOKIE_NAMES} */
export const STALE_AUTH_COOKIE_NAMES = BID_SESSION_COOKIE_NAMES;

/** Expire stale Better Auth cookies in the browser (see middleware comment for domain/secure matching). */
export function purgeStaleAuthCookies(
  response: NextResponse,
  opts?: { nodeEnv?: string; allowHttpCookies?: string },
): void {
  const env = {
    NODE_ENV: opts?.nodeEnv ?? process.env.NODE_ENV,
    ALLOW_HTTP_COOKIES: opts?.allowHttpCookies ?? process.env.ALLOW_HTTP_COOKIES,
  };
  const secure = env.NODE_ENV === "production" && env.ALLOW_HTTP_COOKIES !== "true";
  for (const name of STALE_AUTH_COOKIE_NAMES) {
    response.cookies.set(name, "", {
      path: "/",
      expires: new Date(0),
      maxAge: 0,
      sameSite: "lax",
      secure,
    });
  }
}
