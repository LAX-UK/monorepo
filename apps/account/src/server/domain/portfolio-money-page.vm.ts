import {
  type LaxMoneyEntryV1,
  type MoneyFilter,
  type MoneyVm,
  buildMoney,
} from "@auction/lax-ecosystem";

export type MoneyPageVm = {
  money: MoneyVm;
  /** Currencies present in the unfiltered entries, so a filter never offers one that has none. */
  currencies: string[];
  /**
   * True only when every product answered in full and had nothing to show. If one could not
   * answer, an empty ledger may only mean "not loaded", so no empty-state claim is made.
   */
  showEmptyState: boolean;
};

export function buildMoneyPage(
  entries: readonly LaxMoneyEntryV1[],
  filter: MoneyFilter,
  complete: boolean,
): MoneyPageVm {
  const money = buildMoney(entries, filter);
  return {
    money,
    currencies: [...new Set(entries.map((entry) => entry.currency))].sort(),
    showEmptyState: complete && money.isEmpty,
  };
}
