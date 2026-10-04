const DEFAULT_STOREFRONT = "https://test-shop.lax.bid";

export function storefrontBaseUrl(): string {
  return (process.env.SHOP_STOREFRONT_URL ?? DEFAULT_STOREFRONT).replace(/\/+$/, "");
}

/** True when the print detail page indicates the edition cannot be purchased. */
export async function printAppearsUnavailable(
  fetchImpl: typeof fetch,
  slug: string,
): Promise<boolean> {
  const res = await fetchImpl(`${storefrontBaseUrl()}/prints/${slug}`, {
    redirect: "follow",
  });
  if (!res.ok) return true;
  const html = await res.text();
  const unavailable =
    /sold out|not available|unavailable|on hold|currently unavailable/i.test(html) ||
    !/add to basket|add to cart/i.test(html);
  return unavailable;
}
