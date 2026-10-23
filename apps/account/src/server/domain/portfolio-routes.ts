import type { LaxPortfolioItemV1 } from "@auction/lax-ecosystem";

export const PORTFOLIO_ROUTES = {
  overview: "/account/portfolio",
  money: "/account/portfolio/money",
} as const;

/** The work's page in Account; the id is a product's own key, so it is escaped. */
export function workDetailHref(item: Pick<LaxPortfolioItemV1, "product" | "id">): string {
  return `${PORTFOLIO_ROUTES.overview}/${item.product}/${encodeURIComponent(item.id)}`;
}
