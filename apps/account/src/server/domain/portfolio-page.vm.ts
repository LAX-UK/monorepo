import {
  type HoldingsFilter,
  type HoldingsVm,
  type LaxPortfolioItemV1,
  type LaxProductId,
  type PortfolioEmptyState,
  buildHoldings,
  buildPortfolioHeader,
  holdingsFilterOptions,
  portfolioEmptyState,
} from "@auction/lax-ecosystem";
import { type CollectionVm, buildCollection } from "./collection.vm";
import { type AttentionRowVm, buildAttentionRows } from "./portfolio-attention.vm";
import { type WorksByProductVm, buildWorksByProduct } from "./works-by-product.vm";

export type PortfolioPageVm = {
  /** The summary card at the top: the same figures Home shows in "Your collection". */
  collection: CollectionVm;
  /** Works by product; null when fewer than two products hold works. */
  worksByProduct: WorksByProductVm | null;
  attention: AttentionRowVm[];
  holdings: HoldingsVm;
  options: ReturnType<typeof holdingsFilterOptions>;
  /**
   * Which empty-state copy to lead with. It is null whenever a product could not answer in
   * full, because then an empty list may only mean "not loaded", and welcoming the person as a
   * new collector would be wrong.
   */
  emptyState: PortfolioEmptyState | null;
};

export function buildPortfolioPage(
  items: readonly LaxPortfolioItemV1[],
  filter: HoldingsFilter,
  complete: boolean,
  unanswered: readonly LaxProductId[] = [],
): PortfolioPageVm {
  return {
    collection: buildCollection(buildPortfolioHeader(items), items.length),
    worksByProduct: buildWorksByProduct(items, unanswered),
    attention: buildAttentionRows(items),
    holdings: buildHoldings(items, filter),
    options: holdingsFilterOptions(items),
    emptyState: complete ? portfolioEmptyState(items) : null,
  };
}
