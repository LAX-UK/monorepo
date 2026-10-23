import type { LaxMoneyResponseV1, LaxPortfolioResponseV1 } from "@auction/lax-ecosystem";
import type { PortalPortfolioReader } from "../ports/portal-portfolio.reader.js";
import {
  type ShopPortfolioContext,
  buildShopMoneyEntries,
  buildShopPortfolioItems,
} from "./shop-portfolio.adapter.js";

export type LaxPortfolioHandlerDeps = {
  reader: PortalPortfolioReader;
  /** Same switches as the owner-portal reads this view is built from. */
  flags: { portalOwnershipEnabled: boolean; payoutsEnabled: boolean };
  context: Omit<ShopPortfolioContext, "imageUrl">;
  resolveMediaUrl(value: string | null | undefined): string | null;
};

export type LaxPortfolioHandlers = {
  getPortfolio(identitySubjectId: string): Promise<LaxPortfolioResponseV1>;
  getMoney(identitySubjectId: string): Promise<LaxMoneyResponseV1>;
};

/**
 * A switched-off feature is not an error here: the person simply has nothing to show from it,
 * so the response is empty or short and flagged `partial`, never a 404 that a consumer could
 * mistake for "Shop is down".
 */
export function createLaxPortfolioHandlers(deps: LaxPortfolioHandlerDeps): LaxPortfolioHandlers {
  const { reader, flags } = deps;
  const context: ShopPortfolioContext = {
    ...deps.context,
    imageUrl: (key) => deps.resolveMediaUrl(key),
  };
  const partial = !flags.portalOwnershipEnabled || !flags.payoutsEnabled;
  const partialFlag = partial ? { partial: true as const } : {};

  return {
    async getPortfolio(identitySubjectId) {
      if (!flags.portalOwnershipEnabled) return { items: [], ...partialFlag };
      const facts = await reader.loadFacts(identitySubjectId, {
        includeSales: flags.payoutsEnabled,
      });
      return { items: buildShopPortfolioItems(facts, context), ...partialFlag };
    },

    async getMoney(identitySubjectId) {
      if (!flags.portalOwnershipEnabled) return { entries: [], ...partialFlag };
      const facts = await reader.loadFacts(identitySubjectId, {
        includeSales: flags.payoutsEnabled,
      });
      return { entries: buildShopMoneyEntries(facts, context), ...partialFlag };
    },
  };
}
