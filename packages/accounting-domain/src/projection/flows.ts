import { ok } from "../result.js";
import {
  type BidPaymentFacts,
  type BidPaymentGroupFacts,
  projectBidPaymentCaptured,
  projectBidPaymentGroupSettled,
} from "./bid-payments.js";
import {
  type BidBuyerDefaultFacts,
  type BidDeliveryRefundFacts,
  type BidRefundReversedFacts,
  type BidRefundsFacts,
  projectBidBuyerDefault,
  projectBidDeliveryRefunded,
  projectBidPaymentRefunded,
  projectBidRefundReversed,
} from "./bid-refunds.js";
import { type BidInvoiceFacts, projectBidInvoiceRaised } from "./bid.js";
import { EMPTY_PROJECTION, type ProjectionPolicy } from "./projection.js";
import { type ShopRefundsFacts, projectShopRefundSettled } from "./shop-refunds.js";
import { type ShopOrderPaidFacts, projectShopOrderPaid } from "./shop.js";

/**
 * Every money flow the books will follow, one projection policy each. Nine are built;
 * the others are listed so the set is visible in one place, and project nothing until their own
 * change builds them (each is waiting on code or on an accountant's answer).
 */
export const ACCOUNTING_FLOWS = [
  "bid_invoice_raised",
  "bid_payment_captured",
  "bid_payment_refunded",
  "bid_payment_refund_reversed",
  "bid_payment_group_settled",
  "bid_delivery_refunded",
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
  readonly bid_payment_refund_reversed: BidRefundReversedFacts;
  readonly bid_payment_group_settled: BidPaymentGroupFacts;
  readonly bid_delivery_refunded: BidDeliveryRefundFacts;
  readonly bid_buyer_default: BidBuyerDefaultFacts;
  readonly bid_payout_settled: NotBuiltYet;
  readonly shop_order_paid: ShopOrderPaidFacts;
  readonly shop_refund_settled: ShopRefundsFacts;
}

/** NOT BUILT: a placeholder policy that projects nothing. */
const notBuiltYet: ProjectionPolicy<NotBuiltYet> = () => ok(EMPTY_PROJECTION);

export const PROJECTION_POLICIES: {
  readonly [F in AccountingFlow]: ProjectionPolicy<FlowFacts[F]>;
} = {
  bid_invoice_raised: projectBidInvoiceRaised,
  bid_payment_captured: projectBidPaymentCaptured,
  bid_payment_refunded: projectBidPaymentRefunded,
  bid_payment_refund_reversed: projectBidRefundReversed,
  bid_payment_group_settled: projectBidPaymentGroupSettled,
  bid_delivery_refunded: projectBidDeliveryRefunded,
  bid_buyer_default: projectBidBuyerDefault,
  bid_payout_settled: notBuiltYet,
  shop_order_paid: projectShopOrderPaid,
  shop_refund_settled: projectShopRefundSettled,
};

/** The flows whose policy is built; only these are wired to events. */
export const BUILT_FLOWS = [
  "bid_invoice_raised",
  "bid_payment_captured",
  "bid_payment_refunded",
  "bid_payment_refund_reversed",
  "bid_payment_group_settled",
  "bid_delivery_refunded",
  "bid_buyer_default",
  "shop_order_paid",
  "shop_refund_settled",
] as const satisfies readonly AccountingFlow[];
export type BuiltFlow = (typeof BUILT_FLOWS)[number];
