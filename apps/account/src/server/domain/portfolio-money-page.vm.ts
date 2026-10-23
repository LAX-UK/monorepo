import {
  type CurrencyTotal,
  type LaxBusinessKey,
  type LaxMoneyEntryV1,
  type MoneyFilter,
  type MoneySectionKey,
  type MoneyVm,
  buildMoney,
} from "@auction/lax-ecosystem";
import { MONEY_SECTION_LABELS } from "./portfolio-labels";
import { PORTFOLIO_ROUTES } from "./portfolio-routes";

/** One line of a business card: a category and what it adds up to, one figure per currency. */
export type MoneySummaryLineVm = {
  section: MoneySectionKey;
  label: string;
  /** Empty when every entry in the category was cancelled, so nothing counts. */
  totals: CurrencyTotal[];
};

/** A business's totals, with a link to its payment lines in the ledger. */
export type MoneySummaryCardVm = {
  key: LaxBusinessKey;
  legalName: string;
  lines: MoneySummaryLineVm[];
  /** The ledger filtered to this business; other active filters are kept. */
  ledgerHref: string;
};

export type MoneyPageVm = {
  money: MoneyVm;
  /** Totals per business and category. Nothing is netted and no currencies are blended. */
  summary: MoneySummaryCardVm[];
  /** Currencies present in the unfiltered entries, so a filter never offers one that has none. */
  currencies: string[];
  /**
   * True only when every product answered in full and had nothing to show. If one could not
   * answer, an empty ledger may only mean "not loaded", so no empty-state claim is made.
   */
  showEmptyState: boolean;
};

/** Anchor on the ledger section, so following a card lands on the lines it summarises. */
export const LEDGER_ANCHOR = "ledger";

export function ledgerHrefFor(business: LaxBusinessKey, filter: MoneyFilter): string {
  const query = new URLSearchParams({ business });
  if (filter.section) query.set("section", filter.section);
  if (filter.currency) query.set("currency", filter.currency);
  return `${PORTFOLIO_ROUTES.money}?${query.toString()}#${LEDGER_ANCHOR}`;
}

export function buildMoneyPage(
  entries: readonly LaxMoneyEntryV1[],
  filter: MoneyFilter,
  complete: boolean,
): MoneyPageVm {
  const money = buildMoney(entries, filter);
  return {
    money,
    summary: money.groups.map((group) => ({
      key: group.key,
      legalName: group.legalName,
      ledgerHref: ledgerHrefFor(group.key, filter),
      lines: group.sections.map((section) => ({
        section: section.section,
        label: MONEY_SECTION_LABELS[section.section],
        totals: section.subtotals,
      })),
    })),
    currencies: [...new Set(entries.map((entry) => entry.currency))].sort(),
    showEmptyState: complete && money.isEmpty,
  };
}
