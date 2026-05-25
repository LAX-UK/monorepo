import type { NextResponse } from "next/server";

/** Better Auth cookie names that may carry a stale session after server-side invalidation. */
export const STALE_AUTH_COOKIE_NAMES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
  "better-auth.session_data",
  "__Secure-better-auth.session_data",
  "better-auth.dont_remember",
  "__Secure-better-auth.dont_remember",
  "better-auth.two_factor",
  "__Secure-better-auth.two_factor",
] as const;

export function authCookieDomain(): string | undefined {
  const domain =
    process.env.NEXT_PUBLIC_COOKIE_DOMAIN?.trim() || process.env.COOKIE_DOMAIN?.trim() || undefined;
  return domain || undefined;
}

/** Expire stale Better Auth cookies in the browser (see middleware comment for domain/secure matching). */
export function purgeStaleAuthCookies(
  response: NextResponse,
  opts?: { nodeEnv?: string; cookieDomain?: string | undefined },
): void {
  const domain = opts?.cookieDomain ?? authCookieDomain();
  const secure = (opts?.nodeEnv ?? process.env.NODE_ENV) === "production";
  for (const name of STALE_AUTH_COOKIE_NAMES) {
    response.cookies.set(name, "", {
      path: "/",
      expires: new Date(0),
      maxAge: 0,
      sameSite: "lax",
      secure,
      ...(domain ? { domain } : {}),
    });
  }
}
