/**
 * Which LAX product a visitor came from. Dependency-free on purpose: the middleware runs on the
 * Edge runtime and imports this module, so it must not pull in config, branding or Node APIs.
 */

/** The LAX product the visitor arrived from (`bid`, `shop` or `art`); a session cookie. */
export const ORIGIN_PRODUCT_COOKIE = "lax-account-origin-product";

/** The products a visitor can arrive from; each one's origin comes from configuration. */
export const ORIGIN_PRODUCT_IDS = ["bid", "shop", "art"] as const;
export type OriginProductId = (typeof ORIGIN_PRODUCT_IDS)[number];

/** The configured public URL of each product; a product without one is not an allowed origin. */
export type OriginProductConfig = Readonly<Record<OriginProductId, string | undefined>>;

export function originOf(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function isOriginProductId(value: string | null | undefined): value is OriginProductId {
  return (ORIGIN_PRODUCT_IDS as readonly string[]).includes(value ?? "");
}

/**
 * The product whose configured origin equals the origin of `raw` (a referrer or a URL), or null.
 * Only the three configured origins match, so a foreign host never becomes a link target.
 */
export function productForOrigin(
  raw: string | null | undefined,
  urls: OriginProductConfig,
): OriginProductId | null {
  const origin = originOf(raw);
  if (!origin) return null;
  return ORIGIN_PRODUCT_IDS.find((id) => originOf(urls[id]) === origin) ?? null;
}

/**
 * The product a visitor came from. An explicit `from=<product>` wins; it names a product, never a
 * URL, so the destination is always one of our configured origins. Without it, the referrer's
 * origin must match one of them.
 */
export function detectOriginProduct(
  input: { from?: string | null; referrer?: string | null },
  urls: OriginProductConfig,
): OriginProductId | null {
  const from = input.from?.trim().toLowerCase();
  if (isOriginProductId(from) && urls[from]) return from;
  return productForOrigin(input.referrer, urls);
}
