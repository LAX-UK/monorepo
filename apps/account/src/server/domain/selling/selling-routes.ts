import {
  SELLING_TOOLS,
  type SellerAccess,
  type SellingTool,
  showsSellingTool,
} from "./selling-access";

export const SELLING_ROUTES = {
  overview: "/account/selling",
  editions: "/account/selling/editions",
  sales: "/account/selling/sales",
  payouts: "/account/selling/payouts",
  artworks: "/account/selling/artworks",
  application: "/account/selling/application",
  salesCsv: "/account/selling/sales/statement.csv",
} as const satisfies Record<SellingTool | "overview" | "salesCsv", string>;

/** Tab names: short, because each page's title says it in full ("Editions you can sell"). */
export const SELLING_TOOL_LABELS: Record<SellingTool, string> = {
  editions: "Editions",
  sales: "Sales",
  payouts: "Payouts",
  artworks: "Artworks",
  application: "Application",
};

export type SellingTabVm = { tool: SellingTool; label: string; href: string; current: boolean };

/**
 * The tabs across the Selling pages: the tools the person holds, and always the page they are
 * on (which may be open during an outage, when no role could be confirmed). One tab alone is
 * not shown, because there is nothing to switch between.
 */
export function buildSellingTabs(access: SellerAccess, current: SellingTool): SellingTabVm[] {
  const tabs = SELLING_TOOLS.filter(
    (tool) => tool === current || showsSellingTool(access, tool),
  ).map((tool) => ({
    tool,
    label: SELLING_TOOL_LABELS[tool],
    href: SELLING_ROUTES[tool],
    current: tool === current,
  }));
  return tabs.length > 1 ? tabs : [];
}
