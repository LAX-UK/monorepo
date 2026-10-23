import type { LaxResourceId } from "@auction/identity-contracts";

/**
 * The product APIs that answer for a person's works and money. LAX Shop and lax.art share one
 * API, so one source covers both and its rows say which product they belong to.
 */
export const PORTFOLIO_SOURCES = ["bid", "shop"] as const;
export type PortfolioSourceId = (typeof PORTFOLIO_SOURCES)[number];

export type PortfolioSourceDescriptor = {
  /** How a failure names the source to the person. */
  label: string;
  resource: LaxResourceId;
  portfolioPath: string;
  moneyPath: string;
};

export const PORTFOLIO_SOURCE_DESCRIPTORS: Readonly<
  Record<PortfolioSourceId, PortfolioSourceDescriptor>
> = {
  bid: {
    label: "LAX Bid",
    resource: "lax-bid-api",
    portfolioPath: "/users/me/lax-portfolio",
    moneyPath: "/users/me/lax-money",
  },
  shop: {
    label: "LAX Shop and lax.art",
    resource: "lax-shop-api",
    portfolioPath: "/v1/me/lax-portfolio",
    moneyPath: "/v1/me/lax-money",
  },
};

/** What one source answered: its rows, or that it could not answer at all. */
export type SourceResult<Row> =
  | { status: "ok"; rows: readonly Row[]; partial: boolean }
  | { status: "unavailable" };

export type SourceResults<Row> = Record<PortfolioSourceId, SourceResult<Row>>;
