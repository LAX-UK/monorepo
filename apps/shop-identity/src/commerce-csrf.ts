import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

export const SHOP_COMMERCE_CSRF_COOKIE = "shop_commerce_csrf";

export function ensureCommerceCsrfCookie(c: Context, secure: boolean): string {
  const existing = getCookie(c, SHOP_COMMERCE_CSRF_COOKIE);
  if (existing && existing.length >= 16 && existing.length <= 64) {
    return existing;
  }
  const token = randomBytes(24).toString("base64url");
  setCookie(c, SHOP_COMMERCE_CSRF_COOKIE, token, {
    httpOnly: false,
    secure,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return token;
}

export function clearCommerceCsrfCookie(c: Context): void {
  deleteCookie(c, SHOP_COMMERCE_CSRF_COOKIE, { path: "/" });
}

export function assertStorefrontOrigin(c: Context, storefrontOrigin: string): void {
  const origin = c.req.header("origin");
  if (origin && origin !== storefrontOrigin) {
    throw new Error("invalid_origin");
  }
}

export function assertCommerceCsrf(c: Context, storefrontOrigin: string): void {
  assertStorefrontOrigin(c, storefrontOrigin);
  const cookie = getCookie(c, SHOP_COMMERCE_CSRF_COOKIE);
  const header = c.req.header("x-shop-csrf");
  if (!cookie || !header) {
    throw new Error("csrf_required");
  }
  const left = Buffer.from(cookie);
  const right = Buffer.from(header);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new Error("csrf_mismatch");
  }
}
