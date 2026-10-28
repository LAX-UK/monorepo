import { loadArtEnv } from "@/env.server";
import {
  type LaxFamilyLinkVm,
  type LaxProductLinkVm,
  buildCrossProductFooterLinks,
  buildLaxFamilyLinksFromDirectory,
  buildProductDirectoryLinks,
  isLocalProductFallbackAllowed,
  resolveLaxAccountOrigin,
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
    allowLocalFallback: isLocalProductFallbackAllowed(process.env),
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

/** LAX Account's home, with the same default as Bid and Shop when the origin is not set. */
function artLaxAccountHref(): string {
  return `${resolveLaxAccountOrigin(
    process.env.NEXT_PUBLIC_LAX_ACCOUNT_ORIGIN,
    process.env.NODE_ENV,
  )}/account`;
}

/** The LAX top bar's links on lax.art: the products, then LAX Account. */
export function loadArtFamilyLinks(): LaxFamilyLinkVm[] {
  const resolved = resolveProductDirectoryConfig(artDirectoryInput());
  if (!resolved.ok) return [];
  return buildLaxFamilyLinksFromDirectory(resolved.config, artLaxAccountHref());
}
