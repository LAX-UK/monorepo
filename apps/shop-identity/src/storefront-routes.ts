import type { ShopIdentityEnv } from "./env.js";

export function shopStorefrontBaseUrl(env: Pick<ShopIdentityEnv, "SHOP_STOREFRONT_URL">): string {
  return env.SHOP_STOREFRONT_URL.replace(/\/+$/, "");
}

/** Fixed storefront paths — not derived from request input. */
export function shopStorefrontPath(
  env: Pick<ShopIdentityEnv, "SHOP_STOREFRONT_URL">,
  pathname: string,
): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${shopStorefrontBaseUrl(env)}${path}`;
}
