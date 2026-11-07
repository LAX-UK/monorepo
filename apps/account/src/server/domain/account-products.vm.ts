import type { LaxAccountConfig } from "../config";

export type AccountProductId = "bid" | "shop" | "art";

export type AccountProductVm = {
  id: AccountProductId;
  name: string;
  /** What the card says when the person has nothing in the product yet. */
  invitation: string;
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
    ["art", "lax.art", "Discover original art.", config.laxArtPublicUrl],
    ["shop", "LAX Shop", "Browse signed and limited editions.", config.shopPublicUrl],
    ["bid", "LAX Bid", "Find your next lot.", config.bidPublicUrl],
  ];
  return candidates.flatMap(([id, name, invitation, href]) =>
    href ? [{ id, name, invitation, href }] : [],
  );
}
