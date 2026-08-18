import type { NextResponse } from "next/server";

/** Bid BFF cookie names used in HTTP development and HTTPS production. */
export const STALE_AUTH_COOKIE_NAMES = ["lax-bid-session", "__Host-lax-bid-session"] as const;

/** Expire stale Better Auth cookies in the browser (see middleware comment for domain/secure matching). */
export function purgeStaleAuthCookies(response: NextResponse, opts?: { nodeEnv?: string }): void {
  const secure = (opts?.nodeEnv ?? process.env.NODE_ENV) === "production";
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
