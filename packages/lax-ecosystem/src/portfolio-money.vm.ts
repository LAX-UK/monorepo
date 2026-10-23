import { type CurrencyTotal, sumByCurrency } from "./currency-totals.js";
import {
  LAX_BUSINESS_KEYS,
  type LaxBusinessKey,
  type LaxMoneyEntryV1,
} from "./lax-portfolio-contract.v1.js";

/**
 * The contract's `owed_to_you` direction covers both payouts still to come and payouts already
 * received. Those are different facts for a seller, so the view splits them into two sections.
 */
export const MONEY_SECTION_KEYS = [
  "owed_by_you",
  "due_to_you",
  "received",
  "paid",
  "refunded",
  "fee",
] as const;
export type MoneySectionKey = (typeof MONEY_SECTION_KEYS)[number];

export function moneySectionOf(entry: LaxMoneyEntryV1): MoneySectionKey {
  if (entry.direction !== "owed_to_you") return entry.direction;
  return entry.status === "completed" ? "received" : "due_to_you";
}

export type MoneyFilter = {
  business?: LaxBusinessKey;
  section?: MoneySectionKey;
  currency?: string;
};

export type MoneyDirectionSectionVm = {
  section: MoneySectionKey;
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
  if (filter.section && moneySectionOf(entry) !== filter.section) return false;
  if (filter.currency && entry.currency !== filter.currency) return false;
  return true;
}

/**
 * Groups money by the business that owns it, then by section, with per-currency subtotals.
 * Sections stay separate on purpose: what you owe is never netted against what you are owed,
 * what is still due is never added to what has been received, and no figure mixes currencies.
 */
export function buildMoney(entries: readonly LaxMoneyEntryV1[], filter: MoneyFilter = {}): MoneyVm {
  const visible = entries.filter((entry) => matches(entry, filter)).sort(newestFirst);
  const groups: MoneyBusinessGroupVm[] = [];
  for (const key of LAX_BUSINESS_KEYS) {
    const ofBusiness = visible.filter((entry) => entry.business.key === key);
    const first = ofBusiness[0];
    if (!first) continue;
    const sections = MONEY_SECTION_KEYS.flatMap((section) => {
      const ofSection = ofBusiness.filter((entry) => moneySectionOf(entry) === section);
      if (ofSection.length === 0) return [];
      return [
        {
          section,
          subtotals: sumByCurrency(ofSection.filter((entry) => entry.status !== "cancelled")),
          entries: ofSection,
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
