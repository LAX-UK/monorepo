import type { MiddlewareHandler } from "hono";

const PROMPT_COOKIE_NAMES = ["oidc_login_prompt", "oidc_consent_prompt"] as const;

function hardenPromptCookie(setCookie: string): string {
  let next = setCookie;
  if (!/\bHttpOnly\b/i.test(next)) {
    next = `${next}; HttpOnly`;
  }
  if (!/\bSecure\b/i.test(next)) {
    next = `${next}; Secure`;
  }
  return next;
}

function isPromptCookie(setCookie: string): boolean {
  const lower = setCookie.toLowerCase();
  return PROMPT_COOKIE_NAMES.some((name) => lower.startsWith(`${name}=`));
}

/** Adds HttpOnly and Secure to Better Auth OIDC prompt cookies. */
export function createOidcPromptCookieHardeningMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    await next();
    const values = c.res.headers.getSetCookie?.() ?? [];
    if (values.length === 0) return;
    c.res.headers.delete("set-cookie");
    for (const value of values) {
      c.res.headers.append("set-cookie", isPromptCookie(value) ? hardenPromptCookie(value) : value);
    }
  };
}
