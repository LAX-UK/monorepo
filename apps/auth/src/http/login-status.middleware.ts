import type { MiddlewareHandler } from "hono";

const SET_LOGIN_HEADER = "Set-Login";

function sessionCookieMutated(setCookieHeader: string | undefined): "set" | "cleared" | null {
  if (!setCookieHeader) return null;
  const lower = setCookieHeader.toLowerCase();
  if (!lower.includes("better-auth.session_token")) {
    return null;
  }
  if (/max-age=0|expires=thu, 01 jan 1970/i.test(setCookieHeader)) {
    return "cleared";
  }
  return "set";
}

export function createLoginStatusMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    await next();
    const setCookieValues = c.res.headers.getSetCookie?.() ?? [];
    if (setCookieValues.length === 0) {
      const single = c.res.headers.get("set-cookie");
      if (single) setCookieValues.push(single);
    }
    for (const value of setCookieValues) {
      const mutation = sessionCookieMutated(value);
      if (mutation === "set") {
        c.res.headers.set(SET_LOGIN_HEADER, "logged-in");
        return;
      }
      if (mutation === "cleared") {
        c.res.headers.set(SET_LOGIN_HEADER, "logged-out");
        return;
      }
    }
  };
}
