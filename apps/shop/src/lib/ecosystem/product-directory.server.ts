import { loadShopEnv } from "@/env";
import { isShopIndexingAllowedForHost } from "@/lib/seo/shop-indexing";
import {
  type LaxProductLinkVm,
  buildCrossProductFooterLinks,
  buildProductDirectoryLinks,
  isAllowedLaxProductUrl,
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

function shopDirectoryInput() {
  const bidPublicUrl = readBidPublicUrl();
  const shopStorefrontUrl = readShopStorefrontUrl();
  return {
    currentProductId: "shop" as const,
    ...(bidPublicUrl ? { bidPublicUrl } : {}),
    ...(shopStorefrontUrl ? { shopStorefrontUrl } : {}),
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
