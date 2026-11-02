import { LAX_PRODUCT_NAMES } from "@auction/branding";
import type { LaxAccountConfig } from "../config";

/** The products a visitor can arrive from; each one's origin comes from configuration. */
export const ORIGIN_PRODUCT_IDS = ["bid", "shop", "art"] as const;
export type OriginProductId = (typeof ORIGIN_PRODUCT_IDS)[number];

export type OriginProductConfig = Pick<
  LaxAccountConfig,
  "bidPublicUrl" | "shopPublicUrl" | "laxArtPublicUrl"
>;

/** Where each product lives, as configured; a product without a URL is not an allowed origin. */
function configuredUrls(config: OriginProductConfig): Record<OriginProductId, string | undefined> {
  return { bid: config.bidPublicUrl, shop: config.shopPublicUrl, art: config.laxArtPublicUrl };
}

function originOf(raw: string | null | undefined): string | null {
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
  config: OriginProductConfig,
): OriginProductId | null {
  const origin = originOf(raw);
  if (!origin) return null;
  const urls = configuredUrls(config);
  return ORIGIN_PRODUCT_IDS.find((id) => originOf(urls[id]) === origin) ?? null;
}

/**
 * The product a visitor came from. An explicit `from=<product>` wins; it names a product, never a
 * URL, so the destination is always one of our configured origins. Without it, the referrer's
 * origin must match one of them.
 */
export function detectOriginProduct(
  input: { from?: string | null; referrer?: string | null },
  config: OriginProductConfig,
): OriginProductId | null {
  const from = input.from?.trim().toLowerCase();
  if (isOriginProductId(from) && configuredUrls(config)[from]) return from;
  return productForOrigin(input.referrer, config);
}

export type BackToProductVm = { id: OriginProductId; label: string; href: string };

/** The link back to the remembered product, or null when none is known or it is not configured. */
export function buildBackToProduct(
  remembered: string | null | undefined,
  config: OriginProductConfig,
): BackToProductVm | null {
  if (!isOriginProductId(remembered)) return null;
  const origin = originOf(configuredUrls(config)[remembered]);
  if (!origin) return null;
  return { id: remembered, label: `Back to ${LAX_PRODUCT_NAMES[remembered]}`, href: origin };
}
