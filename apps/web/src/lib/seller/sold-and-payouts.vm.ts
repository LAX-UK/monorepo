import type { SoldLot } from "@/lib/data/http/workspace-selling.schema";
import { formatMoney } from "@/lib/format-currency";
import { formatPeriod } from "@/lib/ui/format";
import { csvDocument } from "@/lib/workspace/csv";
import type { Payout } from "@auction/types";

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
  /** `null` when the sold lots could not be read; the payouts still show. */
  sold: SoldLot[] | null;
  payouts: PayoutRow[];
};

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

/** Payouts as CSV, one line each, amounts as the page shows them. */
export function payoutsCsv(payouts: readonly PayoutRow[]): string {
  return csvDocument(
    ["period", "status", "sales", "commission_and_fees", "amount", "payout_id"],
    payouts.map((payout) => [
      payout.period,
      payout.status,
      payout.gross,
      payout.fees,
      payout.net,
      payout.id,
    ]),
  );
}
