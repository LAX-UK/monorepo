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
import {
  type BidPayoutFacts,
  type ShopArtistPayoutFacts,
  projectBidPayoutPaid,
  projectBidPayoutSettled,
  projectShopArtistPayoutPaid,
} from "./payouts.js";
import type { ProjectionPolicy } from "./projection.js";
import { type ShopOriginalSalePaidFacts, projectShopOriginalSalePaid } from "./shop-original.js";
import {
  type ShopRefundReversedFacts,
  type ShopRefundsFacts,
  projectShopRefundReversed,
  projectShopRefundSettled,
} from "./shop-refunds.js";
import { type ShopOrderPaidFacts, projectShopOrderPaid } from "./shop.js";

/**
 * Every money flow the books will follow, one projection policy each. All are built; a flow whose
 * booking waits for an accountant's answer parks what it makes until then.
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
  "bid_payout_paid",
  "shop_order_paid",
  "shop_refund_settled",
  "shop_refund_reversed",
  "shop_original_sale_paid",
  "shop_artist_payout_paid",
] as const;
export type AccountingFlow = (typeof ACCOUNTING_FLOWS)[number];

/** The facts each flow's policy is given. */
export interface FlowFacts {
  readonly bid_invoice_raised: BidInvoiceFacts;
  readonly bid_payment_captured: BidPaymentFacts;
  readonly bid_payment_refunded: BidRefundsFacts;
  readonly bid_payment_refund_reversed: BidRefundReversedFacts;
  readonly bid_payment_group_settled: BidPaymentGroupFacts;
  readonly bid_delivery_refunded: BidDeliveryRefundFacts;
  readonly bid_buyer_default: BidBuyerDefaultFacts;
  readonly bid_payout_settled: BidPayoutFacts;
  readonly bid_payout_paid: BidPayoutFacts;
  readonly shop_order_paid: ShopOrderPaidFacts;
  readonly shop_refund_settled: ShopRefundsFacts;
  readonly shop_refund_reversed: ShopRefundReversedFacts;
  readonly shop_original_sale_paid: ShopOriginalSalePaidFacts;
  readonly shop_artist_payout_paid: ShopArtistPayoutFacts;
}

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
  bid_payout_settled: projectBidPayoutSettled,
  bid_payout_paid: projectBidPayoutPaid,
  shop_order_paid: projectShopOrderPaid,
  shop_refund_settled: projectShopRefundSettled,
  shop_refund_reversed: projectShopRefundReversed,
  shop_original_sale_paid: projectShopOriginalSalePaid,
  shop_artist_payout_paid: projectShopArtistPayoutPaid,
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
  "bid_payout_settled",
  "bid_payout_paid",
  "shop_order_paid",
  "shop_refund_settled",
  "shop_refund_reversed",
  "shop_original_sale_paid",
  "shop_artist_payout_paid",
] as const satisfies readonly AccountingFlow[];
export type BuiltFlow = (typeof BUILT_FLOWS)[number];
