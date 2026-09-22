import {
  type LaxProductLinkVm,
  buildCrossProductFooterLinks,
  buildProductDirectoryLinks,
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

function bidDirectoryInput() {
  const bidPublicUrl = readBidPublicUrl();
  const shopStorefrontUrl = readShopStorefrontUrl();
  return {
    currentProductId: "bid" as const,
    ...(bidPublicUrl ? { bidPublicUrl } : {}),
    ...(shopStorefrontUrl ? { shopStorefrontUrl } : {}),
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
