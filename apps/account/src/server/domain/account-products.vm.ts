import type { LaxAccountConfig } from "../config";

export type AccountProductId = "bid" | "shop" | "art";

export type AccountProductVm = {
  id: AccountProductId;
  name: string;
  tagline: string;
  href: string;
};

/**
 * The products this one account signs in to. A product without a configured URL is left out
 * rather than linking nowhere. Account does not know which products the person has used, so
 * no card claims usage.
 */
export function buildAccountProducts(
  config: Pick<LaxAccountConfig, "bidPublicUrl" | "shopPublicUrl" | "laxArtPublicUrl">,
): AccountProductVm[] {
  const candidates: Array<[AccountProductId, string, string, string | undefined]> = [
    ["bid", "LAX Bid", "Bid on auctions", config.bidPublicUrl],
    ["shop", "LAX Shop", "Browse and buy", config.shopPublicUrl],
    ["art", "LAX Art", "Discover and collect art", config.laxArtPublicUrl],
  ];
  return candidates.flatMap(([id, name, tagline, href]) =>
    href ? [{ id, name, tagline, href }] : [],
  );
}
