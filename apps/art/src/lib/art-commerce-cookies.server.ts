import {
  ART_IDENTITY_ID_TOKEN_COOKIE,
  ART_IDENTITY_SESSION_COOKIE,
} from "@/lib/art-identity.server";
import {
  SHOP_BASKET_COOKIE,
  SHOP_COMMERCE_CSRF_COOKIE,
  buildCommerceCookieHeader,
} from "@auction/shop-portal/bff";

export { SHOP_BASKET_COOKIE, SHOP_COMMERCE_CSRF_COOKIE };

export const ART_COMMERCE_COOKIE_NAMES = new Set([
  ART_IDENTITY_SESSION_COOKIE,
  ART_IDENTITY_ID_TOKEN_COOKIE,
  SHOP_BASKET_COOKIE,
  SHOP_COMMERCE_CSRF_COOKIE,
]);

export function artCommerceCookieHeader(
  entries: ReadonlyArray<{ name: string; value: string }>,
): string | undefined {
  return buildCommerceCookieHeader(entries, ART_COMMERCE_COOKIE_NAMES);
}
