import {
  SHOP_IDENTITY_ID_TOKEN_COOKIE,
  SHOP_IDENTITY_SESSION_COOKIE,
} from "@/lib/shop-identity.server";

/** Must match apps/shop-identity commerce cookie names. */
export const SHOP_BASKET_COOKIE = "shop_basket_token";
export const SHOP_COMMERCE_CSRF_COOKIE = "shop_commerce_csrf";

export const SHOP_COMMERCE_COOKIE_NAMES = new Set([
  SHOP_IDENTITY_SESSION_COOKIE,
  SHOP_IDENTITY_ID_TOKEN_COOKIE,
  SHOP_BASKET_COOKIE,
  SHOP_COMMERCE_CSRF_COOKIE,
]);

export function shopCommerceCookieHeader(
  entries: ReadonlyArray<{ name: string; value: string }>,
): string | undefined {
  const filtered = entries.filter((entry) => SHOP_COMMERCE_COOKIE_NAMES.has(entry.name));
  if (filtered.length === 0) return undefined;
  return filtered.map((entry) => `${entry.name}=${entry.value}`).join("; ");
}
