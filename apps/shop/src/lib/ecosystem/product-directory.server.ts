import { loadShopEnv } from "@/env";
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
  const raw = readShopStorefrontUrl() ?? "http://localhost:3020";
  if (!isAllowedLaxProductUrl(raw)) {
    throw new Error("LAX_SHOP_STOREFRONT_URL must be HTTPS or a localhost URL");
  }
  return new URL(normalizeProductBaseUrl(raw));
}
