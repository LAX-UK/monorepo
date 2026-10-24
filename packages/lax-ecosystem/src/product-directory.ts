import {
  type ProductUrlValidationOptions,
  isAllowedLaxProductUrl,
  normalizeProductBaseUrl,
} from "./safe-product-url.js";

export const LAX_PRODUCT_IDS = ["bid", "shop", "art"] as const;
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
  /** A product whose URL is not configured is absent, so its link is omitted rather than guessed. */
  bidPublicUrl?: string;
  shopStorefrontUrl?: string;
  artPublicUrl?: string;
};

export type ResolveProductDirectoryInput = {
  currentProductId: LaxProductId;
  bidPublicUrl?: string;
  shopStorefrontUrl?: string;
  artPublicUrl?: string;
  /** Defaults used when env is unset (local dev). */
  defaultBidPublicUrl?: string;
  defaultShopStorefrontUrl?: string;
  defaultArtPublicUrl?: string;
  urlValidation?: ProductUrlValidationOptions;
  /**
   * When false, an unset product URL is left out of the config instead of falling back to a
   * localhost port. Deployed runtimes must pass false (see `isLocalProductFallbackAllowed`).
   * Defaults to true so local development works without any env.
   */
  allowLocalFallback?: boolean;
};

/**
 * Localhost fallbacks are only for development, tests and the Next.js production build (which
 * renders without runtime env). A running production server must never link to localhost.
 */
export function isLocalProductFallbackAllowed(
  source: Readonly<Record<string, string | undefined>>,
): boolean {
  return source.NODE_ENV !== "production" || source.NEXT_PHASE === "phase-production-build";
}

export type ResolveProductDirectoryResult =
  | { ok: true; config: ProductDirectoryConfig }
  | { ok: false; error: string };

const PRODUCT_LABELS: Record<LaxProductId, string> = {
  bid: "LAX Bid",
  shop: "LAX Shop",
  art: "LAX Art",
};

export function resolveProductDirectoryConfig(
  input: ResolveProductDirectoryInput,
): ResolveProductDirectoryResult {
  const allowFallback = input.allowLocalFallback ?? true;
  const pick = (configured: string | undefined, fallback: string | undefined, local: string) =>
    configured?.trim() || fallback?.trim() || (allowFallback ? local : undefined);

  const bidRaw = pick(input.bidPublicUrl, input.defaultBidPublicUrl, "http://localhost:3000");
  const shopRaw = pick(
    input.shopStorefrontUrl,
    input.defaultShopStorefrontUrl,
    "http://localhost:3020",
  );
  const artRaw = pick(input.artPublicUrl, input.defaultArtPublicUrl, "http://localhost:3050");

  const validation = input.urlValidation;
  if (bidRaw !== undefined && !isAllowedLaxProductUrl(bidRaw, validation)) {
    return { ok: false, error: "Invalid LAX Bid public URL" };
  }
  if (shopRaw !== undefined && !isAllowedLaxProductUrl(shopRaw, validation)) {
    return { ok: false, error: "Invalid LAX Shop storefront URL" };
  }
  if (artRaw !== undefined && !isAllowedLaxProductUrl(artRaw, validation)) {
    return { ok: false, error: "Invalid LAX Art public URL" };
  }

  try {
    return {
      ok: true,
      config: {
        currentProductId: input.currentProductId,
        ...(bidRaw !== undefined ? { bidPublicUrl: normalizeProductBaseUrl(bidRaw) } : {}),
        ...(shopRaw !== undefined ? { shopStorefrontUrl: normalizeProductBaseUrl(shopRaw) } : {}),
        ...(artRaw !== undefined ? { artPublicUrl: normalizeProductBaseUrl(artRaw) } : {}),
      },
    };
  } catch {
    return { ok: false, error: "Product URL normalization failed" };
  }
}

export function buildProductDirectoryLinks(config: ProductDirectoryConfig): LaxProductLinkVm[] {
  const entries: Array<{ id: LaxProductId; href: string | undefined }> = [
    { id: "bid", href: config.bidPublicUrl },
    { id: "art", href: config.artPublicUrl },
    { id: "shop", href: config.shopStorefrontUrl },
  ];

  return entries
    .filter((entry): entry is { id: LaxProductId; href: string } => entry.href !== undefined)
    .map(({ id, href }) => ({
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
