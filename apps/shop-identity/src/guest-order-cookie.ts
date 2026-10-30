import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";

/**
 * Holds the token that opens the guest's latest order without an account, so the confirmation
 * page after payment and a link opened from the email work without the token staying in a URL.
 */
export const SHOP_GUEST_ORDER_COOKIE_NAME = "shop_guest_order";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function readGuestOrderToken(c: Context): string | null {
  const token = getCookie(c, SHOP_GUEST_ORDER_COOKIE_NAME);
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

export function writeGuestOrderToken(
  c: Context,
  token: string,
  expiresAt: Date,
  secure: boolean,
): void {
  const secondsLeft = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
  setCookie(c, SHOP_GUEST_ORDER_COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: "Lax",
    path: "/",
    maxAge: Math.max(0, Math.min(MAX_AGE_SECONDS, secondsLeft)),
  });
}
