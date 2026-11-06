import {
  LAX_BUSINESS_KEYS,
  type LaxBusinessKey,
  type LaxMoneyEntryV1,
  type LaxPortfolioItemV1,
} from "./lax-portfolio-contract.v1.js";
import { buildPortfolioHeader } from "./portfolio-header.vm.js";
import { buildMoney } from "./portfolio-money.vm.js";

/** The two ways Portfolio and Money state the same fact, for one business and currency. */
export type PortfolioMoneyAgreement = {
  business: LaxBusinessKey;
  currency: string;
  /** Portfolio header "Total due". */
  totalDue: number;
  /** Money "Owed by you". */
  owedByYou: number;
  /** Portfolio header "Paid so far". */
  paidSoFar: number;
  /** Money "Paid". */
  moneyPaid: number;
};

const amountIn = (totals: readonly { currency: string; amount: number }[], currency: string) =>
  totals.find((total) => total.currency === currency)?.amount ?? 0;

/**
 * Reads Portfolio and Money from the same facts and lines their figures up per business and
 * currency. Both pages must state one number for what is owed and one for what was paid; this
 * is the single place that pairs them, so a test can assert they agree.
 */
export function portfolioMoneyAgreement(
  items: readonly LaxPortfolioItemV1[],
  entries: readonly LaxMoneyEntryV1[],
): PortfolioMoneyAgreement[] {
  const money = buildMoney(entries);
  return LAX_BUSINESS_KEYS.flatMap((business) => {
    const header = buildPortfolioHeader(items.filter((item) => item.business.key === business));
    const sections = money.groups.find((group) => group.key === business)?.sections ?? [];
    const subtotals = (section: string) =>
      sections.find((candidate) => candidate.section === section)?.subtotals ?? [];
    const currencies = new Set(
      [
        ...header.totalDue,
        ...header.paidSoFar,
        ...subtotals("owed_by_you"),
        ...subtotals("paid"),
      ].map((total) => total.currency),
    );
    return [...currencies].sort().map((currency) => ({
      business,
      currency,
      totalDue: amountIn(header.totalDue, currency),
      owedByYou: amountIn(subtotals("owed_by_you"), currency),
      paidSoFar: amountIn(header.paidSoFar, currency),
      moneyPaid: amountIn(subtotals("paid"), currency),
    }));
  });
}
