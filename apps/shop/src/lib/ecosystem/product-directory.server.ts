import { loadShopEnv } from "@/env";
import { laxAccountUrl } from "@/lib/lax-account-url";
import { isShopIndexingAllowedForHost } from "@/lib/seo/shop-indexing";
import {
  type LaxFamilyLinkVm,
  type LaxProductLinkVm,
  buildCrossProductFooterLinks,
  buildLaxFamilyLinksFromDirectory,
  buildProductDirectoryLinks,
  isAllowedLaxProductUrl,
  isLocalProductFallbackAllowed,
  normalizeProductBaseUrl,
  resolveProductDirectoryConfig,
} from "@auction/lax-ecosystem";

function readBidPublicUrl(): string | undefined {
  const env = loadShopEnv();
  return env.LAX_BID_PUBLIC_URL ?? env.WEB_ORIGIN;
}

function readShopStorefrontUrl(): string | undefined {
  const env = loadShopEnv();
  return env.LAX_SHOP_STOREFRONT_URL ?? env.SHOP_STOREFRONT_URL;
}

function readArtPublicUrl(): string | undefined {
  return loadShopEnv().LAX_ART_PUBLIC_URL;
}

function shopDirectoryInput() {
  const bidPublicUrl = readBidPublicUrl();
  const shopStorefrontUrl = readShopStorefrontUrl();
  const artPublicUrl = readArtPublicUrl();
  return {
    currentProductId: "shop" as const,
    allowLocalFallback: isLocalProductFallbackAllowed(process.env),
    ...(bidPublicUrl ? { bidPublicUrl } : {}),
    ...(shopStorefrontUrl ? { shopStorefrontUrl } : {}),
    ...(artPublicUrl ? { artPublicUrl } : {}),
  };
}

export function loadShopProductDirectoryLinks(): LaxProductLinkVm[] {
  const resolved = resolveProductDirectoryConfig(shopDirectoryInput());
  if (!resolved.ok) return [];
  return buildProductDirectoryLinks(resolved.config);
}

export function loadShopCrossProductFooterLinks(): LaxProductLinkVm[] {
  const resolved = resolveProductDirectoryConfig(shopDirectoryInput());
  if (!resolved.ok) return [];
  return buildCrossProductFooterLinks(resolved.config);
}

/** The LAX top bar's links on Shop: the products, then LAX Account. */
export function loadShopFamilyLinks(): LaxFamilyLinkVm[] {
  const resolved = resolveProductDirectoryConfig(shopDirectoryInput());
  if (!resolved.ok) return [];
  return buildLaxFamilyLinksFromDirectory(resolved.config, laxAccountUrl());
}

/** The lax.art base URL, or null when it is not configured for this environment. */
export function loadShopArtBaseUrl(): URL | null {
  const art = loadShopCrossProductFooterLinks().find((link) => link.id === "art");
  return art ? new URL(art.href) : null;
}

export function loadShopStorefrontBaseUrl(): URL {
  const isNextProductionBuild = process.env.NEXT_PHASE === "phase-production-build";
  const raw =
    readShopStorefrontUrl() ??
    (process.env.NODE_ENV === "production" && !isNextProductionBuild
      ? undefined
      : "http://localhost:3020");
  if (!raw) {
    throw new Error("LAX_SHOP_STOREFRONT_URL is required in production.");
  }
  if (!isAllowedLaxProductUrl(raw)) {
    throw new Error("LAX_SHOP_STOREFRONT_URL must be HTTPS or a localhost URL");
  }
  return new URL(normalizeProductBaseUrl(raw));
}

export function isShopIndexingAllowed(): boolean {
  return isShopIndexingAllowedForHost(
    loadShopStorefrontBaseUrl().hostname,
    loadShopEnv().SHOP_ALLOW_INDEXING,
  );
}
