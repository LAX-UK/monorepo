import {
  type HoldingsFilter,
  type HoldingsVm,
  type LaxPortfolioItemV1,
  type PortfolioEmptyState,
  type PortfolioHeaderVm,
  buildHoldings,
  buildPortfolioHeader,
  holdingsFilterOptions,
  portfolioEmptyState,
} from "@auction/lax-ecosystem";
import { type AttentionRowVm, buildAttentionRows } from "./portfolio-attention.vm";

export type PortfolioPageVm = {
  header: PortfolioHeaderVm;
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
): PortfolioPageVm {
  return {
    header: buildPortfolioHeader(items),
    attention: buildAttentionRows(items),
    holdings: buildHoldings(items, filter),
    options: holdingsFilterOptions(items),
    emptyState: complete ? portfolioEmptyState(items) : null,
  };
}
