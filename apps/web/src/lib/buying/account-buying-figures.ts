import type { AccountScope } from "@/lib/account-scope/account-scope";
import { groupMyBids } from "@/lib/bid/my-bid-status";
import type { BidWithLot } from "@/lib/data/dto/dashboard-dtos";
import { lotChargeCurrency } from "@/lib/money/currency";
import {
  type AmountOwedEntry,
  type DashboardFigures,
  type MoneyTotal,
  type PurchasePaymentRole,
  purchasePaymentRole,
  sumMoneyByCurrency,
  summariseAmountsOwed,
} from "@auction/domain";
import type { PortfolioRow } from "@auction/types";

/**
 * The buying figures. Open bids come from the same rows the Bids page lists, with the same rules
 * (`groupMyBids`); what is to pay comes from the amounts-owed reading that Purchases and the menu
 * also use. Home's figures and the menu counts come from here, so a figure always equals the page
 * it links to.
 */

/** The most the account has committed on a lot: its highest bid or automatic-bid ceiling. */
function commitment(rows: readonly BidWithLot[]): string {
  let top = 0;
  for (const { bid } of rows) {
    top = Math.max(top, Number(bid.amount), Number(bid.maxAutoBidAmount ?? 0));
  }
  return top.toFixed(2);
}

/** Lots in the Active view of Bids, with the most the account could pay on each, per currency. */
export function openBidsFigure(
  bids: readonly BidWithLot[],
  userId: string,
): NonNullable<DashboardFigures["openBids"]> {
  const { active } = groupMyBids(bids, userId);
  const totals: MoneyTotal[] = active.flatMap(({ row }) => {
    const { lot } = row;
    if (!lot) return [];
    const onLot = bids.filter((candidate) => candidate.bid.lotId === lot.id);
    return [{ currency: lotChargeCurrency(lot), amount: commitment(onLot) }];
  });
  return { lots: active.length, totalMax: sumMoneyByCurrency(totals) };
}

/** What the person pays themselves and has yet to pay, per currency; the amounts-owed reading. */
export function purchasesToPayFigure(
  entries: readonly AmountOwedEntry[],
): NonNullable<DashboardFigures["purchasesToPay"]> {
  const { count, totals } = summariseAmountsOwed(entries);
  return { purchases: count, totals };
}

/**
 * How the signed-in person stands to one purchase of the account in use. A personal list also
 * holds lots the person won for an organisation; those are paid by that organisation, so the
 * person is told how payment is going and is never offered a Pay button for them.
 */
export function paymentRoleFor(
  scope: AccountScope,
  row: { lot: Pick<PortfolioRow["lot"], "winnerId" | "buyerLegalEntityId"> },
): PurchasePaymentRole {
  const { account } = scope;
  const winnerId = row.lot.winnerId ?? null;
  if (account.kind === "organisation") {
    return purchasePaymentRole({
      payerUserId: scope.actor.userId,
      lot: { winnerId, buyerAccountKind: "organisation" },
      membership: account.actor,
    });
  }
  const wonForAnotherAccount = Boolean(
    account.id && row.lot.buyerLegalEntityId && row.lot.buyerLegalEntityId !== account.id,
  );
  if (wonForAnotherAccount) return winnerId === scope.actor.userId ? "informed" : "none";
  return purchasePaymentRole({
    payerUserId: scope.actor.userId,
    lot: { winnerId, buyerAccountKind: "individual" },
    membership: null,
  });
}
