import type { PortalSellerAccess } from "@auction/shop-contracts";
import type { SellingRead } from "../../ports/selling-gateway";

/**
 * Whether the person holds a seller role: "yes", "no", or "unknown" when the lookup failed.
 * The menu shows Selling only on "yes"; a page turns the person away only on "no", so an outage
 * never locks a seller out of a page that can show its own error.
 */
export type SellerProbe = "yes" | "no" | "unknown";

export type SellerAccess = {
  /** Has editions approved for sale, or has asked to sell some. */
  editions: SellerProbe;
  /** Is paid by LAX for sales: a seller, or someone with sales or payouts on record. */
  payouts: SellerProbe;
  /** Is linked to an artist profile. */
  artist: SellerProbe;
  /** Has applied to join the gallery as an artist. */
  application: SellerProbe;
};

export const UNKNOWN_SELLER_ACCESS: SellerAccess = {
  editions: "unknown",
  payouts: "unknown",
  artist: "unknown",
  application: "unknown",
};

const NO_SELLER_ACCESS: SellerAccess = {
  editions: "no",
  payouts: "no",
  artist: "no",
  application: "no",
};

const probe = (value: boolean): SellerProbe => (value ? "yes" : "no");

/** Shop decides the roles from the person's own records; switched off means none. */
export function sellerAccessFromRead(read: SellingRead<PortalSellerAccess>): SellerAccess {
  switch (read.status) {
    case "ok":
      return {
        editions: probe(read.data.editions),
        payouts: probe(read.data.payouts),
        artist: probe(read.data.artist),
        // Absent from shop APIs older than artist applications: nobody has applied there.
        application: probe(read.data.application ?? false),
      };
    case "off":
      return NO_SELLER_ACCESS;
    case "unavailable":
      return UNKNOWN_SELLER_ACCESS;
  }
}

export type SellingTool = "editions" | "sales" | "payouts" | "artworks" | "application";

export const SELLING_TOOLS: readonly SellingTool[] = [
  "editions",
  "sales",
  "payouts",
  "artworks",
  "application",
];

const TOOL_ROLE: Record<SellingTool, keyof SellerAccess> = {
  editions: "editions",
  sales: "payouts",
  payouts: "payouts",
  artworks: "artist",
  application: "application",
};

/** Whether the tool is offered in the Selling tabs. */
export function showsSellingTool(access: SellerAccess, tool: SellingTool): boolean {
  return access[TOOL_ROLE[tool]] === "yes";
}

/** Whether the tool's page opens; only a definite "no" turns the person away. */
export function opensSellingTool(access: SellerAccess, tool: SellingTool): boolean {
  return access[TOOL_ROLE[tool]] !== "no";
}

/** Whether the Selling entry appears in the account menu. A plain buyer never sees it. */
export function showsSelling(access: SellerAccess | null): boolean {
  return access !== null && SELLING_TOOLS.some((tool) => showsSellingTool(access, tool));
}

/**
 * The tool the Selling entry opens: the first the person holds, else the first that is not
 * ruled out (so an outage lands on a page that explains it); null when every role is "no".
 */
export function firstSellingTool(access: SellerAccess): SellingTool | null {
  return (
    SELLING_TOOLS.find((tool) => showsSellingTool(access, tool)) ??
    SELLING_TOOLS.find((tool) => opensSellingTool(access, tool)) ??
    null
  );
}
