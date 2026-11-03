import { LAX_PRODUCT_NAMES } from "@auction/branding";
import {
  type OriginProductConfig,
  type OriginProductId,
  isOriginProductId,
  originOf,
} from "../../lib/origin-product";
import type { LaxAccountConfig } from "../config";

export {
  type OriginProductConfig,
  type OriginProductId,
  detectOriginProduct,
  productForOrigin,
} from "../../lib/origin-product";

/** The configured product URLs, in the shape the origin helpers take. */
export function originProductUrls(
  config: Pick<LaxAccountConfig, "bidPublicUrl" | "shopPublicUrl" | "laxArtPublicUrl">,
): OriginProductConfig {
  return { bid: config.bidPublicUrl, shop: config.shopPublicUrl, art: config.laxArtPublicUrl };
}

export type BackToProductVm = { id: OriginProductId; label: string; href: string };

/** The link back to the remembered product, or null when none is known or it is not configured. */
export function buildBackToProduct(
  remembered: string | null | undefined,
  urls: OriginProductConfig,
): BackToProductVm | null {
  if (!isOriginProductId(remembered)) return null;
  const origin = originOf(urls[remembered]);
  if (!origin) return null;
  return { id: remembered, label: `Back to ${LAX_PRODUCT_NAMES[remembered]}`, href: origin };
}
