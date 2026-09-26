import type { CookieJar, CookieSetOptions } from "@auction/identity-rp";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

export function createHonoCookieJar(c: Context, secureCookies: boolean): CookieJar {
  return {
    get: (name) => getCookie(c, name),
    set: (name, value, options: CookieSetOptions) => {
      setCookie(c, name, value, {
        httpOnly: options.httpOnly ?? true,
        secure: secureCookies,
        sameSite: options.sameSite ?? "Lax",
        path: options.path ?? "/",
        maxAge: options.maxAgeSeconds,
      });
    },
    delete: (name) => {
      deleteCookie(c, name, { path: "/" });
    },
  };
}
