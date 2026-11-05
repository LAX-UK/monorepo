import type {
  PrivateSaleDeal,
  PrivateSaleDealPayment,
  PrivateSalePaymentStatus,
} from "@auction/types";
import { dealPayoutAmounts } from "./settlement-amounts.js";

/** Why a deal's payment or payout cannot go ahead. One code per reason. */
export type DealMoneyBlockerCode =
  | "deal_not_invoiced"
  | "price_not_set"
  | "deal_not_released"
  | "payment_not_received"
  | "commission_not_set"
  | "payout_not_positive";

export type DealMoneyBlocker = { code: DealMoneyBlockerCode };

/** The buyer pays once the invoice is issued, and only for an agreed price. */
export function dealPaymentBlockers(
  deal: Pick<PrivateSaleDeal, "stage" | "priceMinor">,
): DealMoneyBlocker[] {
  if (deal.stage !== "invoiced") return [{ code: "deal_not_invoiced" }];
  if (deal.priceMinor === null) return [{ code: "price_not_set" }];
  return [];
}

/**
 * The seller is paid only after the work is released and the buyer's money is in, and only when
 * there is something to pay. Paying after release protects against a buyer dispute.
 */
export function dealPayoutBlockers(
  deal: Pick<PrivateSaleDeal, "stage" | "priceMinor" | "sellerCommissionBps" | "costsMinor">,
  payment: Pick<PrivateSaleDealPayment, "status"> | null,
): DealMoneyBlocker[] {
  if (deal.stage !== "released") return [{ code: "deal_not_released" }];
  if (!payment || payment.status !== "paid") return [{ code: "payment_not_received" }];
  if (deal.sellerCommissionBps === null) return [{ code: "commission_not_set" }];
  const amounts = dealPayoutAmounts(deal);
  if (!amounts || amounts.netMinor <= 0) return [{ code: "payout_not_positive" }];
  return [];
}

/** The moves a deal payment can make. A terminal status has none. */
export const DEAL_PAYMENT_TRANSITIONS: Readonly<
  Record<PrivateSalePaymentStatus, readonly PrivateSalePaymentStatus[]>
> = {
  open: ["processing", "paid", "cancelled"],
  processing: ["paid", "cancelled"],
  paid: ["refunded"],
  cancelled: [],
  refunded: [],
};

export const canMoveDealPayment = (
  from: PrivateSalePaymentStatus,
  to: PrivateSalePaymentStatus,
): boolean => DEAL_PAYMENT_TRANSITIONS[from].includes(to);

/** A payment still holds the deal: the buyer may not start another while one is open or paid. */
export const dealPaymentIsLive = (status: PrivateSalePaymentStatus): boolean =>
  status === "open" || status === "processing" || status === "paid";

/** A paid deal may be cancelled only once all of the buyer's money has gone back. */
export const dealRefundRecorded = (
  payment: Pick<PrivateSaleDealPayment, "status" | "amountMinor" | "refundedMinor"> | null,
): boolean =>
  payment !== null && payment.status === "refunded" && payment.refundedMinor >= payment.amountMinor;
