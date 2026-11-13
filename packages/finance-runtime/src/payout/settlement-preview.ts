import {
  type HeldSettlementSale,
  minorUnitsToMoneyString,
  parseMoneyToMinorUnits,
  sellerClawbackPence,
  sellerDeductionsPence,
} from "@auction/domain";
import type { IPayoutRepository } from "@auction/persistence/interfaces";
import type { ISettlementSellerTerms } from "./settlement-seller-terms.js";

/** What the next payout run would pay a seller, worked out the way the run pays it. */
export type SettlementPreview = {
  /** The hammer total of the sales the run would pay, less the seller's share of part refunds. */
  pendingGross: string;
  /** The agreement's commission and the VAT on it, across those sales. */
  pendingPlatformFee: string;
  /** What the seller would receive. */
  pendingNet: string;
  /** How many sales the run would pay. */
  paymentCount: number;
  /** Sales waiting that the run would leave out, because their seller terms are held. */
  heldSales: HeldSettlementSale[];
  /** Capture time of the oldest payment waiting, when any is. */
  earliestCapturedAt: Date | null;
};

const money = (pence: number) => minorUnitsToMoneyString(BigInt(pence));

/**
 * The next payout run for a seller, priced as the run prices it and with nothing stored: each sale
 * from its seller terms (held ones left out), with a part refund the buyer had before payout taken
 * off as the run takes it off.
 */
export async function previewSettlement(
  repo: Pick<IPayoutRepository, "findUnlinkedCapturedPayments">,
  sellerTerms: ISettlementSellerTerms,
  legalEntityId: string,
): Promise<SettlementPreview> {
  const pending = await repo.findUnlinkedCapturedPayments(legalEntityId);
  let gross = 0;
  let deductions = 0;
  let paymentCount = 0;
  const heldSales: HeldSettlementSale[] = [];
  for (const payment of pending) {
    const sale = await sellerTerms.forPreview(payment, legalEntityId);
    if (sale.kind === "held") {
      heldSales.push({ paymentId: sale.paymentId, lotId: sale.lotId, reason: sale.reason });
      continue;
    }
    if (sale.kind !== "ready") continue;
    paymentCount += 1;
    gross += sale.terms.hammerPence;
    deductions += sellerDeductionsPence(sale.terms);
    if (payment.refundedPence > 0) {
      gross -= sellerClawbackPence({
        sellerNetPence: sale.terms.sellerNetPence,
        paymentPence: Number(parseMoneyToMinorUnits(payment.amount)),
        buyerRefundedPence: payment.refundedPence,
      });
    }
  }
  return {
    pendingGross: money(gross),
    pendingPlatformFee: money(deductions),
    pendingNet: money(gross - deductions),
    paymentCount,
    heldSales,
    earliestCapturedAt: pending.reduce<Date | null>(
      (oldest, p) => (p.capturedAt && (!oldest || p.capturedAt < oldest) ? p.capturedAt : oldest),
      null,
    ),
  };
}
