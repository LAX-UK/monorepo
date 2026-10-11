import {
  SHOP_IDENTITY_ID_TOKEN_COOKIE,
  SHOP_IDENTITY_SESSION_COOKIE,
} from "@/lib/shop-identity.server";
import {
  SHOP_BASKET_COOKIE,
  SHOP_COMMERCE_CSRF_COOKIE,
  buildCommerceCookieHeader,
} from "@auction/shop-portal/bff";

export { SHOP_BASKET_COOKIE, SHOP_COMMERCE_CSRF_COOKIE };

export const SHOP_COMMERCE_COOKIE_NAMES = new Set([
  SHOP_IDENTITY_SESSION_COOKIE,
  SHOP_IDENTITY_ID_TOKEN_COOKIE,
  SHOP_BASKET_COOKIE,
  SHOP_COMMERCE_CSRF_COOKIE,
]);

export function shopCommerceCookieHeader(
  entries: ReadonlyArray<{ name: string; value: string }>,
): string | undefined {
  return buildCommerceCookieHeader(entries, SHOP_COMMERCE_COOKIE_NAMES);
}
