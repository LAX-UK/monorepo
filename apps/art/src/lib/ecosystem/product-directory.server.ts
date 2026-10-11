import { loadArtEnv } from "@/env.server";
import {
  type LaxProductLinkVm,
  buildCrossProductFooterLinks,
  buildProductDirectoryLinks,
  resolveProductDirectoryConfig,
} from "@auction/lax-ecosystem";

function readBidPublicUrl(): string | undefined {
  const env = loadArtEnv();
  return env.LAX_BID_PUBLIC_URL ?? env.WEB_ORIGIN;
}

function readShopStorefrontUrl(): string | undefined {
  const env = loadArtEnv();
  return env.LAX_SHOP_STOREFRONT_URL ?? env.SHOP_STOREFRONT_URL;
}

function readArtStorefrontUrl(): string | undefined {
  const env = loadArtEnv();
  return env.LAX_ART_PUBLIC_URL;
}

function artDirectoryInput() {
  const bidPublicUrl = readBidPublicUrl();
  const shopStorefrontUrl = readShopStorefrontUrl();
  const artPublicUrl = readArtStorefrontUrl();
  return {
    currentProductId: "art" as const,
    ...(bidPublicUrl ? { bidPublicUrl } : {}),
    ...(shopStorefrontUrl ? { shopStorefrontUrl } : {}),
    ...(artPublicUrl ? { artPublicUrl } : {}),
  };
}

export function loadArtProductDirectoryLinks(): LaxProductLinkVm[] {
  const resolved = resolveProductDirectoryConfig(artDirectoryInput());
  if (!resolved.ok) return [];
  return buildProductDirectoryLinks(resolved.config);
}

export function loadArtCrossProductFooterLinks(): LaxProductLinkVm[] {
  const resolved = resolveProductDirectoryConfig(artDirectoryInput());
  if (!resolved.ok) return [];
  return buildCrossProductFooterLinks(resolved.config);
}
