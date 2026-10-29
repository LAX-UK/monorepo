import type { LaxBrandProduct } from "./brand-identity.js";

/**
 * How the LAX family names itself in its own navigation: the top bar, the phone menu and the
 * product doors. The products are written as domain names; the shared account keeps its name.
 *
 * These are brand text, not addresses: the Shop is still served from its own host. Sentences,
 * legal copy and emails use `LAX_PRODUCT_NAMES`.
 */
export const LAX_FAMILY_NAMES: Readonly<Record<LaxBrandProduct, string>> = {
  art: "lax.art",
  shop: "lax.shop",
  bid: "lax.bid",
  account: "LAX Account",
};

/** The one order every product shows the family in; it never changes with the current product. */
export const LAX_FAMILY_ORDER = [
  "art",
  "shop",
  "bid",
  "account",
] as const satisfies readonly LaxBrandProduct[];
