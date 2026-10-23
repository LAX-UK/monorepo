import { type CurrencyTotal, sumByCurrency } from "./currency-totals.js";
import {
  LAX_BUSINESS_KEYS,
  LAX_MONEY_DIRECTIONS,
  type LaxBusinessKey,
  type LaxMoneyDirection,
  type LaxMoneyEntryV1,
} from "./lax-portfolio-contract.v1.js";

export type MoneyFilter = {
  business?: LaxBusinessKey;
  direction?: LaxMoneyDirection;
  currency?: string;
};

export type MoneyDirectionSectionVm = {
  direction: LaxMoneyDirection;
  /** Per-currency subtotals of non-cancelled entries only. */
  subtotals: CurrencyTotal[];
  /** Newest first. Cancelled entries stay listed so the ledger is complete. */
  entries: LaxMoneyEntryV1[];
};

export type MoneyBusinessGroupVm = {
  key: LaxBusinessKey;
  legalName: string;
  sections: MoneyDirectionSectionVm[];
};

export type MoneyVm = {
  groups: MoneyBusinessGroupVm[];
  /** Every visible entry, newest first, for the chronological ledger. */
  ledger: LaxMoneyEntryV1[];
  isEmpty: boolean;
  noResults: boolean;
};

const newestFirst = (a: LaxMoneyEntryV1, b: LaxMoneyEntryV1) =>
  Date.parse(b.occurredAt) - Date.parse(a.occurredAt);

function matches(entry: LaxMoneyEntryV1, filter: MoneyFilter): boolean {
  if (filter.business && entry.business.key !== filter.business) return false;
  if (filter.direction && entry.direction !== filter.direction) return false;
  if (filter.currency && entry.currency !== filter.currency) return false;
  return true;
}

/**
 * Groups money by the business that owns it, then by direction, with per-currency subtotals.
 * Directions stay separate sections on purpose: what you owe is never netted against what you
 * are owed, and no figure mixes currencies.
 */
export function buildMoney(entries: readonly LaxMoneyEntryV1[], filter: MoneyFilter = {}): MoneyVm {
  const visible = entries.filter((entry) => matches(entry, filter)).sort(newestFirst);
  const groups: MoneyBusinessGroupVm[] = [];
  for (const key of LAX_BUSINESS_KEYS) {
    const ofBusiness = visible.filter((entry) => entry.business.key === key);
    const first = ofBusiness[0];
    if (!first) continue;
    const sections = LAX_MONEY_DIRECTIONS.flatMap((direction) => {
      const ofDirection = ofBusiness.filter((entry) => entry.direction === direction);
      if (ofDirection.length === 0) return [];
      return [
        {
          direction,
          subtotals: sumByCurrency(ofDirection.filter((entry) => entry.status !== "cancelled")),
          entries: ofDirection,
        },
      ];
    });
    groups.push({ key, legalName: first.business.legalName, sections });
  }
  return {
    groups,
    ledger: visible,
    isEmpty: entries.length === 0,
    noResults: visible.length === 0 && entries.length > 0,
  };
}
