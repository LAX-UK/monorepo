export type BidScope = "bid.read" | "bid.write";

/**
 * Read-only scope LAX Account exchanges for to list a person's own works and money. It opens
 * the portfolio routes and nothing else.
 */
export const PORTFOLIO_READ_SCOPE = "lax.portfolio.read";

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Central resource-scope policy; product capability checks run after this gate. */
export function requiredBidScope(method: string): BidScope {
  return READ_METHODS.has(method.toUpperCase()) ? "bid.read" : "bid.write";
}

export function hasBidScope(scopes: readonly string[], required: BidScope): boolean {
  return scopes.includes(required);
}
