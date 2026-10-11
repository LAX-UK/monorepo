export type StorefrontOrigins = {
  shop: string;
  art: string;
};

export type ShopSalesChannel = "shop" | "art";

function trimOrigin(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function resolveStorefrontOrigins(input: {
  shopStorefrontUrl: string;
  laxArtPublicUrl?: string | undefined;
}): StorefrontOrigins {
  const shop = trimOrigin(input.shopStorefrontUrl);
  const artRaw = input.laxArtPublicUrl?.trim();
  const art = artRaw ? trimOrigin(artRaw) : shop;
  return { shop, art };
}

export function storefrontOriginForChannel(
  origins: StorefrontOrigins,
  salesChannel: ShopSalesChannel,
): string {
  return salesChannel === "art" ? origins.art : origins.shop;
}

export function artworkPublicPath(slug: string): string {
  return `/artworks/${slug}`;
}

export function artworkPublicUrl(
  origins: StorefrontOrigins,
  salesChannel: ShopSalesChannel,
  slug: string,
): string {
  return `${storefrontOriginForChannel(origins, salesChannel)}${artworkPublicPath(slug)}`;
}

function urlOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function allowedConnectReturnOrigins(origins: StorefrontOrigins): readonly string[] {
  const unique = new Set<string>();
  for (const configured of [origins.shop, origins.art]) {
    const origin = urlOrigin(configured);
    if (origin) unique.add(origin);
  }
  return [...unique];
}

export function assertStorefrontReturnUrlAllowed(
  url: string,
  origins: StorefrontOrigins,
  opts?: { failClosed?: boolean },
): void {
  const allowed = allowedConnectReturnOrigins(origins);
  if (allowed.length === 0) {
    if (opts?.failClosed) {
      throw new Error("connect_url_origin_not_configured");
    }
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("connect_url_invalid");
  }

  if (!allowed.some((origin) => parsed.origin === origin)) {
    throw new Error("connect_url_origin_not_allowed");
  }
}
