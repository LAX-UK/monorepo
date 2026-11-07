import type { LaxProductId } from "@auction/lax-ecosystem";
import type { PortfolioSourceId } from "./portfolio-sources";

/** LAX Shop and lax.art share one API, so one failed source leaves both products unanswered. */
const SOURCE_PRODUCTS: Readonly<Record<PortfolioSourceId, readonly LaxProductId[]>> = {
  bid: ["bid"],
  shop: ["shop", "art"],
};

/** The products whose works could not be read, in source order. */
export function unansweredProducts(unavailable: readonly PortfolioSourceId[]): LaxProductId[] {
  return unavailable.flatMap((source) => SOURCE_PRODUCTS[source]);
}
