import { randomBytes } from "node:crypto";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

export const SHOP_BASKET_COOKIE_NAME = "shop_basket_token";

export function readBasketToken(c: Context): string | null {
  const token = getCookie(c, SHOP_BASKET_COOKIE_NAME);
  if (!token || token.length > 128 || !/^[A-Za-z0-9_-]+$/.test(token)) {
    return null;
  }
  return token;
}

export function writeBasketToken(c: Context, token: string, secure: boolean): void {
  setCookie(c, SHOP_BASKET_COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export function rotateBasketToken(c: Context, secure: boolean): string {
  const token = randomBytes(32).toString("base64url");
  writeBasketToken(c, token, secure);
  return token;
}

export function clearBasketToken(c: Context): void {
  deleteCookie(c, SHOP_BASKET_COOKIE_NAME, { path: "/" });
}
