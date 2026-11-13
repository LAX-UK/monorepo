import {
  type HeldSettlementSale,
  minorUnitsToMoneyString,
  sellerDeductionsPence,
} from "@auction/domain";
import type {
  IPayoutRepository,
  IPrivateSaleDealPayoutStore,
} from "@auction/persistence/interfaces";
import { dealLine, refundBeforePayout } from "./payout-settlement.js";
import type { ISettlementSellerTerms } from "./settlement-seller-terms.js";

/** One sale the next run would pay, with every figure from its snapshot. */
export type SettlementPreviewReadySale = {
  kind: "ready";
  paymentId: string;
  lotId: string;
  agreementId: string;
  hammerPence: number;
  commissionBps: number;
  commissionPence: number;
  commissionVatTreatment: "standard" | "not_registered";
  commissionVatBps: number;
  commissionVatPence: number;
  /** The seller's share of a part refund the buyer had before payout, taken off as the run does. */
  refundChargePence: number;
  /** What the seller receives for this sale: the snapshot's net less any refund charge. */
  netPence: number;
};

/** One sale the run would leave out, with the reason staff fix. */
export type SettlementPreviewHeldSale = HeldSettlementSale & {
  kind: "held";
  /** The hammer as the sale's snapshot stored it, when it has one. */
  hammerPence: number | null;
};

export type SettlementPreviewSale = SettlementPreviewReadySale | SettlementPreviewHeldSale;

/** A released private-sale deal the run would pay, split as the run splits it. */
export type SettlementPreviewDeal = {
  dealId: string;
  reference: string;
  /** The agreed price. */
  pricePence: number;
  /** The seller's commission on the deal. */
  commissionPence: number;
  /** The agreed costs taken from the price. */
  costsPence: number;
  /** What the seller receives for the deal. */
  netPence: number;
};

/** What the next payout run would pay a seller, worked out the way the run pays it. */
export type SettlementPreview = {
  /** Every waiting sale in capture order, ready or held. The totals are these lines added up. */
  sales: SettlementPreviewSale[];
  /** Every released private-sale deal the run would pay, from the same source the run reads. */
  deals: SettlementPreviewDeal[];
  /** The hammer total of the sales the run would pay, less the seller's share of part refunds. */
  pendingGross: string;
  /** The agreement's commission and the VAT on it, across those sales. */
  pendingPlatformFee: string;
  /** What the seller would receive. */
  pendingNet: string;
  /** How many lot sales the run would pay (deals are counted in `deals`). */
  paymentCount: number;
  /** Sales waiting that the run would leave out, because their seller terms are held. */
  heldSales: HeldSettlementSale[];
  /** Capture time of the oldest payment waiting, when any is. */
  earliestCapturedAt: Date | null;
};

const money = (pence: number) => minorUnitsToMoneyString(BigInt(pence));

/**
 * The next payout run for a seller, priced as the run prices it and with nothing stored: each sale
 * from its seller terms (held ones left out), a part refund the buyer had before payout charged by
 * the run's own rule, and every released deal the run would pay. The totals are these lines.
 */
export async function previewSettlement(
  repo: Pick<IPayoutRepository, "findUnlinkedCapturedPayments" | "findSellerClawbackFacts">,
  sellerTerms: ISettlementSellerTerms,
  legalEntityId: string,
  dealStore: Pick<IPrivateSaleDealPayoutStore, "findUnsettledReleased"> | null = null,
): Promise<SettlementPreview> {
  const pending = await repo.findUnlinkedCapturedPayments(legalEntityId);
  let gross = 0;
  let deductions = 0;
  let paymentCount = 0;
  const heldSales: HeldSettlementSale[] = [];
  const sales: SettlementPreviewSale[] = [];
  for (const payment of pending) {
    const sale = await sellerTerms.forPreview(payment, legalEntityId);
    if (sale.kind === "held") {
      const held = { paymentId: sale.paymentId, lotId: sale.lotId, reason: sale.reason };
      heldSales.push(held);
      sales.push({
        kind: "held",
        ...held,
        hammerPence: payment.sellerTerms?.snapshot.hammerPence ?? null,
      });
      continue;
    }
    if (sale.kind !== "ready") continue;
    paymentCount += 1;
    const refund = await refundBeforePayout(repo, payment, sale.terms);
    const refundChargePence = refund?.chargePence ?? 0;
    gross += sale.terms.hammerPence - refundChargePence;
    deductions += sellerDeductionsPence(sale.terms);
    sales.push({
      kind: "ready",
      paymentId: sale.paymentId,
      lotId: sale.terms.lotId,
      agreementId: sale.terms.agreementId,
      hammerPence: sale.terms.hammerPence,
      commissionBps: sale.terms.commissionBps,
      commissionPence: sale.terms.commissionPence,
      commissionVatTreatment: sale.terms.commissionVatTreatment,
      commissionVatBps: sale.terms.commissionVatBps,
      commissionVatPence: sale.terms.commissionVatPence,
      refundChargePence,
      netPence: sale.terms.sellerNetPence - refundChargePence,
    });
  }
  const deals: SettlementPreviewDeal[] = [];
  for (const deal of (await dealStore?.findUnsettledReleased(legalEntityId)) ?? []) {
    const line = dealLine(deal);
    if (!line) continue;
    gross += line.amounts.grossMinor;
    deductions += line.amounts.deductionsMinor;
    deals.push({
      dealId: deal.dealId,
      reference: deal.reference,
      pricePence: line.amounts.grossMinor,
      commissionPence: line.amounts.commissionMinor,
      costsPence: line.amounts.costsMinor,
      netPence: line.amounts.netMinor,
    });
  }
  return {
    sales,
    deals,
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
