export type CommerceCookieEntry = { name: string; value: string };

/** Reads storefront cookies forwarded to Shop Identity commerce routes. */
export type CommerceCookiePort = {
  readAll(): Promise<ReadonlyArray<CommerceCookieEntry>>;
  read(name: string): Promise<string | undefined>;
};

/** Must match apps/shop-identity commerce cookie names. */
export const SHOP_BASKET_COOKIE = "shop_basket_token";
export const SHOP_COMMERCE_CSRF_COOKIE = "shop_commerce_csrf";

export function buildCommerceCookieHeader(
  entries: ReadonlyArray<CommerceCookieEntry>,
  allowedNames: ReadonlySet<string>,
): string | undefined {
  const filtered = entries.filter((entry) => allowedNames.has(entry.name));
  if (filtered.length === 0) return undefined;
  return filtered.map((entry) => `${entry.name}=${entry.value}`).join("; ");
}
