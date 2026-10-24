import {
  type LaxProductLinkVm,
  buildCrossProductFooterLinks,
  buildProductDirectoryLinks,
  isLocalProductFallbackAllowed,
  resolveProductDirectoryConfig,
} from "@auction/lax-ecosystem";

function readBidPublicUrl(): string | undefined {
  return (
    process.env.LAX_BID_PUBLIC_URL?.trim() ||
    process.env.WEB_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_WEB_ORIGIN?.trim() ||
    undefined
  );
}

function readShopStorefrontUrl(): string | undefined {
  return (
    process.env.LAX_SHOP_STOREFRONT_URL?.trim() ||
    process.env.SHOP_STOREFRONT_URL?.trim() ||
    undefined
  );
}

function readArtPublicUrl(): string | undefined {
  return process.env.LAX_ART_PUBLIC_URL?.trim() || undefined;
}

function bidDirectoryInput() {
  const bidPublicUrl = readBidPublicUrl();
  const shopStorefrontUrl = readShopStorefrontUrl();
  const artPublicUrl = readArtPublicUrl();
  return {
    currentProductId: "bid" as const,
    allowLocalFallback: isLocalProductFallbackAllowed(process.env),
    ...(bidPublicUrl ? { bidPublicUrl } : {}),
    ...(shopStorefrontUrl ? { shopStorefrontUrl } : {}),
    ...(artPublicUrl ? { artPublicUrl } : {}),
  };
}

export function loadBidProductDirectoryLinks(): LaxProductLinkVm[] {
  const resolved = resolveProductDirectoryConfig(bidDirectoryInput());
  if (!resolved.ok) return [];
  return buildProductDirectoryLinks(resolved.config);
}

export function loadBidCrossProductFooterLinks(): LaxProductLinkVm[] {
  const resolved = resolveProductDirectoryConfig(bidDirectoryInput());
  if (!resolved.ok) return [];
  return buildCrossProductFooterLinks(resolved.config);
}
