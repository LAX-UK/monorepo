import {
  type ProductUrlValidationOptions,
  isAllowedLaxProductUrl,
  normalizeProductBaseUrl,
} from "./safe-product-url.js";

export const LAX_PRODUCT_IDS = ["bid", "shop"] as const;
export type LaxProductId = (typeof LAX_PRODUCT_IDS)[number];

export type LaxProductLinkVm = {
  id: LaxProductId;
  label: string;
  href: string;
  current: boolean;
  external: boolean;
};

export type ProductDirectoryConfig = {
  currentProductId: LaxProductId;
  bidPublicUrl: string;
  shopStorefrontUrl: string;
};

export type ResolveProductDirectoryInput = {
  currentProductId: LaxProductId;
  bidPublicUrl?: string;
  shopStorefrontUrl?: string;
  /** Defaults used when env is unset (local dev). */
  defaultBidPublicUrl?: string;
  defaultShopStorefrontUrl?: string;
  urlValidation?: ProductUrlValidationOptions;
};

export type ResolveProductDirectoryResult =
  | { ok: true; config: ProductDirectoryConfig }
  | { ok: false; error: string };

const PRODUCT_LABELS: Record<LaxProductId, string> = {
  bid: "LAX Bid",
  shop: "LAX Shop",
};

export function resolveProductDirectoryConfig(
  input: ResolveProductDirectoryInput,
): ResolveProductDirectoryResult {
  const bidRaw =
    input.bidPublicUrl?.trim() || input.defaultBidPublicUrl?.trim() || "http://localhost:3000";
  const shopRaw =
    input.shopStorefrontUrl?.trim() ||
    input.defaultShopStorefrontUrl?.trim() ||
    "http://localhost:3020";

  const validation = input.urlValidation;
  if (!isAllowedLaxProductUrl(bidRaw, validation)) {
    return { ok: false, error: "Invalid LAX Bid public URL" };
  }
  if (!isAllowedLaxProductUrl(shopRaw, validation)) {
    return { ok: false, error: "Invalid LAX Shop storefront URL" };
  }

  try {
    return {
      ok: true,
      config: {
        currentProductId: input.currentProductId,
        bidPublicUrl: normalizeProductBaseUrl(bidRaw),
        shopStorefrontUrl: normalizeProductBaseUrl(shopRaw),
      },
    };
  } catch {
    return { ok: false, error: "Product URL normalization failed" };
  }
}

export function buildProductDirectoryLinks(config: ProductDirectoryConfig): LaxProductLinkVm[] {
  const entries: Array<{ id: LaxProductId; href: string }> = [
    { id: "bid", href: config.bidPublicUrl },
    { id: "shop", href: config.shopStorefrontUrl },
  ];

  return entries.map(({ id, href }) => ({
    id,
    label: PRODUCT_LABELS[id],
    href,
    current: id === config.currentProductId,
    external: id !== config.currentProductId,
  }));
}

export function buildCrossProductFooterLinks(config: ProductDirectoryConfig): LaxProductLinkVm[] {
  return buildProductDirectoryLinks(config).filter((link) => !link.current);
}
