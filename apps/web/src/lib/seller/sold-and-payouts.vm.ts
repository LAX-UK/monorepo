import { formatMoney, lotChargeCurrency } from "@/lib/format-currency";
import { lotPath } from "@/lib/seo/url";
import { formatPeriod } from "@/lib/ui/format";
import type { Lot, Payout } from "@auction/types";

export type SoldWorkRow = {
  lotId: string;
  href: string;
  title: string;
  image: string | null;
  lotLabel: string | null;
  saleTitle: string | null;
  hammer: string;
  soldOn: string;
};

export type PayoutRow = {
  id: string;
  period: string;
  gross: string;
  /** LAX's commission and fees, plus the transfer fee when there was one. */
  fees: string;
  net: string;
  status: Payout["status"];
  statementHref: string;
};

export type PayoutDestinationVm = {
  ready: boolean;
  /** Money from paid sales not yet in a payout, when there is any. */
  pending: string | null;
};

export type SoldAndPayoutsVm = {
  destination: PayoutDestinationVm;
  sold: SoldWorkRow[];
  payouts: PayoutRow[];
};

const DAY_MONTH_YEAR = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Works that sold, most recent first: the hammer price is what the buyer bid. */
export function buildSoldWorks(
  lots: readonly Lot[],
  saleTitleById: Readonly<Record<string, string>>,
): SoldWorkRow[] {
  return lots
    .filter((lot) => lot.status === "ended" && Boolean(lot.winnerId ?? lot.hasWinner))
    .sort((a, b) => b.endTime.getTime() - a.endTime.getTime())
    .map((lot) => ({
      lotId: lot.id,
      href: lotPath(lot),
      title: lot.title,
      image: lot.images[0] ?? null,
      lotLabel: lot.lotNumber == null ? null : `Lot ${lot.lotNumber}`,
      saleTitle: lot.saleId ? (saleTitleById[lot.saleId] ?? null) : null,
      hammer: formatMoney(
        lot.checkoutPricing?.hammerMajor ?? lot.currentPrice,
        lotChargeCurrency(lot),
      ),
      soldOn: DAY_MONTH_YEAR.format(lot.endTime),
    }));
}

/** Payouts, newest first, each with its statement. */
export function buildPayoutRows(payouts: readonly Payout[], sellerEntityId: string): PayoutRow[] {
  return [...payouts]
    .sort((a, b) => b.periodEnd.getTime() - a.periodEnd.getTime())
    .map((payout) => {
      const fees =
        Number.parseFloat(payout.platformFee) + Number.parseFloat(payout.stripeFee || "0");
      return {
        id: payout.id,
        period: formatPeriod(payout.periodStart, payout.periodEnd),
        gross: formatMoney(payout.grossAmount, payout.currency),
        fees: formatMoney(Number.isFinite(fees) ? -fees : 0, payout.currency),
        net: formatMoney(payout.netAmount, payout.currency),
        status: payout.status,
        statementHref: `/legal-entities/${encodeURIComponent(sellerEntityId)}/payouts/${encodeURIComponent(payout.id)}/statement`,
      };
    });
}

/** Where payouts go, and what is waiting for the next one. */
export function buildPayoutDestination(input: {
  ready: boolean;
  preview: { paymentCount: number; pendingNet: string; currency: string } | null;
}): PayoutDestinationVm {
  const pending =
    input.preview && input.preview.paymentCount > 0
      ? formatMoney(input.preview.pendingNet, input.preview.currency)
      : null;
  return { ready: input.ready, pending };
}
