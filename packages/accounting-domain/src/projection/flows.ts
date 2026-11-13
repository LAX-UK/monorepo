import { ok } from "../result.js";
import {
  type BidInvoiceFacts,
  type BidPaymentFacts,
  type BidRefundsFacts,
  projectBidInvoiceRaised,
  projectBidPaymentCaptured,
  projectBidPaymentRefunded,
} from "./bid.js";
import { EMPTY_PROJECTION, type ProjectionPolicy } from "./projection.js";

/**
 * Every money flow the books will follow, one projection policy each. The first three are built;
 * the others are listed so the set is visible in one place, and project nothing until their own
 * change builds them (each is waiting on code or on an accountant's answer).
 */
export const ACCOUNTING_FLOWS = [
  "bid_invoice_raised",
  "bid_payment_captured",
  "bid_payment_refunded",
  "bid_payment_group_settled",
  "bid_buyer_default",
  "bid_payout_settled",
  "shop_order_paid",
  "shop_refund_settled",
] as const;
export type AccountingFlow = (typeof ACCOUNTING_FLOWS)[number];

/** Facts for a flow that is not built yet: nothing is read, nothing is projected. */
export interface NotBuiltYet {
  readonly notBuilt: true;
}

/** The facts each flow's policy is given. */
export interface FlowFacts {
  readonly bid_invoice_raised: BidInvoiceFacts;
  readonly bid_payment_captured: BidPaymentFacts;
  readonly bid_payment_refunded: BidRefundsFacts;
  readonly bid_payment_group_settled: NotBuiltYet;
  readonly bid_buyer_default: NotBuiltYet;
  readonly bid_payout_settled: NotBuiltYet;
  readonly shop_order_paid: NotBuiltYet;
  readonly shop_refund_settled: NotBuiltYet;
}

/** NOT BUILT: a placeholder policy that projects nothing. */
const notBuiltYet: ProjectionPolicy<NotBuiltYet> = () => ok(EMPTY_PROJECTION);

export const PROJECTION_POLICIES: {
  readonly [F in AccountingFlow]: ProjectionPolicy<FlowFacts[F]>;
} = {
  bid_invoice_raised: projectBidInvoiceRaised,
  bid_payment_captured: projectBidPaymentCaptured,
  bid_payment_refunded: projectBidPaymentRefunded,
  bid_payment_group_settled: notBuiltYet,
  bid_buyer_default: notBuiltYet,
  bid_payout_settled: notBuiltYet,
  shop_order_paid: notBuiltYet,
  shop_refund_settled: notBuiltYet,
};

/** The flows whose policy is built; only these are wired to events. */
export const BUILT_FLOWS = [
  "bid_invoice_raised",
  "bid_payment_captured",
  "bid_payment_refunded",
] as const satisfies readonly AccountingFlow[];
export type BuiltFlow = (typeof BUILT_FLOWS)[number];
