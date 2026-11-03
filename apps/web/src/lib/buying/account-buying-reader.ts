import type { AccountScope, IAccountScope } from "@/lib/account-scope/account-scope";
import type { BidWithLot } from "@/lib/data/dto/dashboard-dtos";
import type { AmountsOwedView } from "@/lib/data/http/amounts-owed.server";
import type { PortfolioRow } from "@auction/types";

/**
 * The acting account's buying records. Bids, Purchases, Watching, Home and the menu counts all
 * read through this one reader, so a person acting for an organisation sees the organisation's
 * records everywhere, and every figure matches the page behind it.
 */
export interface IAccountBuyingReader {
  /** The account in use, as the rows below were read for it. */
  scope(): Promise<AccountScope>;
  bids(): Promise<BidWithLot[]>;
  purchases(): Promise<PortfolioRow[]>;
  /**
   * What the account owes, lot by lot. The header chip, Purchases, the menu and Home all read
   * this one answer, so a figure is the same wherever it is shown.
   */
  amountsOwed(): Promise<AmountsOwedView>;
}

/** Where each kind of account's records come from. */
export type AccountBuyingSources = {
  personal: {
    bids(): Promise<BidWithLot[]>;
    purchases(): Promise<PortfolioRow[]>;
    amountsOwed(): Promise<AmountsOwedView>;
  };
  organisation: {
    bids(accountId: string): Promise<BidWithLot[]>;
    purchases(accountId: string): Promise<PortfolioRow[]>;
    amountsOwed(accountId: string): Promise<AmountsOwedView>;
  };
};

/**
 * Picks the source from the account scope, so the person's own records are never read while
 * they act for an organisation. Each list is read at most once per reader.
 */
export function createAccountBuyingReader(
  accountScope: IAccountScope,
  sources: AccountBuyingSources,
): IAccountBuyingReader {
  let bids: Promise<BidWithLot[]> | null = null;
  let purchases: Promise<PortfolioRow[]> | null = null;
  let amountsOwed: Promise<AmountsOwedView> | null = null;
  const read = async <T>(
    personal: () => Promise<T>,
    organisation: (accountId: string) => Promise<T>,
  ): Promise<T> => {
    const { account } = await accountScope.current();
    return account.kind === "organisation" ? organisation(account.id) : personal();
  };
  return {
    scope: () => accountScope.current(),
    bids: () => {
      bids ??= read(sources.personal.bids, sources.organisation.bids);
      return bids;
    },
    purchases: () => {
      purchases ??= read(sources.personal.purchases, sources.organisation.purchases);
      return purchases;
    },
    amountsOwed: () => {
      amountsOwed ??= read(sources.personal.amountsOwed, sources.organisation.amountsOwed);
      return amountsOwed;
    },
  };
}
