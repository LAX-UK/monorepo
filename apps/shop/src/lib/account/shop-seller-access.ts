/**
 * Which seller tools a signed-in viewer may use. Shop's account area is "Your orders"; sales,
 * payouts, sale limits and the artist pages belong to people who sell or are paid, so they follow
 * the viewer's own records rather than an environment-wide flag.
 *
 * Each answer is "yes", "no" or "unknown" (the lookup failed). Navigation shows a tool only on
 * "yes"; a route turns the viewer away only on "no", so an outage never locks a seller out of a
 * page that can show its own error.
 */
export type ShopSellerProbe = "yes" | "no" | "unknown";

export type ShopSellerAccess = {
  /** Has staff-granted sale authority on at least one artwork. */
  seller: ShopSellerProbe;
  /** Is a seller, or has sales or payouts on record. */
  payee: ShopSellerProbe;
  /** Is linked to an artist profile. */
  artist: ShopSellerProbe;
};

export type ShopSellerTool = "sales" | "payouts" | "sale-limits" | "artworks" | "artist-sales";

export const NO_SELLER_ACCESS: ShopSellerAccess = { seller: "no", payee: "no", artist: "no" };

/** The fetch outcomes a portal list lookup can end in. */
export type ShopPortalListStatus =
  | "ok"
  | "empty"
  | "unauthorized"
  | "commerce_unavailable"
  | "failed";

/** A list with rows is a "yes"; an empty or switched-off list is a "no"; anything else is unknown. */
export function probeFromListStatus(status: ShopPortalListStatus): ShopSellerProbe {
  switch (status) {
    case "ok":
      return "yes";
    case "empty":
    case "commerce_unavailable":
      return "no";
    case "unauthorized":
    case "failed":
      return "unknown";
  }
}

function anyOf(probes: readonly ShopSellerProbe[]): ShopSellerProbe {
  if (probes.includes("yes")) return "yes";
  if (probes.includes("unknown")) return "unknown";
  return "no";
}

export function resolveShopSellerAccess(input: {
  ownershipEnabled: boolean;
  payoutsEnabled: boolean;
  saleAuthority: ShopSellerProbe;
  payouts: ShopSellerProbe;
  sales: ShopSellerProbe;
  artist: ShopSellerProbe;
}): ShopSellerAccess {
  const seller = input.ownershipEnabled ? input.saleAuthority : "no";
  const payee = input.payoutsEnabled ? anyOf([seller, input.payouts, input.sales]) : "no";
  return { seller, payee, artist: input.artist };
}

const TOOL_ROLE: Record<ShopSellerTool, keyof ShopSellerAccess> = {
  sales: "payee",
  payouts: "payee",
  "sale-limits": "seller",
  artworks: "artist",
  "artist-sales": "artist",
};

/** Whether the tool appears in the viewer's account navigation. */
export function showsSellerTool(access: ShopSellerAccess, tool: ShopSellerTool): boolean {
  return access[TOOL_ROLE[tool]] === "yes";
}

/** Whether the viewer may open the tool's page; only a definite "no" turns them away. */
export function opensSellerTool(access: ShopSellerAccess, tool: ShopSellerTool): boolean {
  return access[TOOL_ROLE[tool]] !== "no";
}
