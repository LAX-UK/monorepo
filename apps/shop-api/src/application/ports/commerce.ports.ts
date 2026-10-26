import type {
  ShopFulfilmentOption,
  ShopFulfilmentStatus,
  ShopOrderStatus,
} from "@auction/shop-domain";
import type { CatalogueCursor } from "../catalogue-cursor.js";

export type BasketOwner =
  | { kind: "anonymous"; tokenHash: string }
  | { kind: "subject"; identitySubjectId: string };

export type BasketLineRecord = {
  lineId: string;
  artworkId: string | null;
  artworkSlug: string | null;
  artworkTitle: string | null;
  productVariantId: string | null;
  productSlug: string | null;
  productTitle: string | null;
  variantSku: string | null;
  unitPricePence: number;
  livePricePence: number | null;
  quantity: number;
  sellableCount: number;
  imageUrl: string | null;
  artistName: string | null;
  artistSlug: string | null;
  /** Editions in the run, for an artwork line; null for merchandise. */
  editionSize: number | null;
};

export type BasketRecord = {
  basketId: string;
  owner: BasketOwner;
  expiresAt: Date;
  lines: BasketLineRecord[];
};

export type ShopDeliveryAddress = {
  recipientName?: string;
  line1: string;
  line2?: string;
  city: string;
  postcode: string;
  country: string;
};

export type CheckoutOrderInput = {
  subject: string;
  basketId: string;
  fulfilment: ShopFulfilmentOption;
  idempotencyKey: string;
  successUrl: string;
  cancelUrl: string;
  deliveryAddress?: ShopDeliveryAddress;
  deliveryPhone?: string;
};

export type CheckoutOrderResult = {
  orderId: string;
  checkoutUrl: string;
  expiresAt: Date;
};

export type ShopDeliveryAddressRecord = {
  recipientName?: string;
  line1: string;
  line2?: string;
  city: string;
  postcode: string;
  country: string;
};

export type OrderLineRecord = {
  orderLineId: string;
  artworkSlug: string | null;
  artworkTitle: string | null;
  artistName: string | null;
  productVariantId: string | null;
  productSlug: string | null;
  productTitle: string | null;
  variantSku: string | null;
  /** Null unless the order is paid and still holds the edition (see `holdsEdition`). */
  editionNumber: number | null;
  /** Editions in the run; null for merchandise. */
  editionSize: number | null;
  unitPricePence: number;
  /** The rate recorded when the line was sold; null when no VAT policy was configured. */
  vatRateBp: number | null;
  /** The VAT the line's price includes, as stored when it was sold. */
  vatPence: number | null;
  /** The artwork's primary image; null for merchandise or a work without one. */
  imageUrl: string | null;
};

export type OrderProgressRecord = {
  status: ShopFulfilmentStatus;
  carrier: string | null;
  trackingNumber: string | null;
  productionStartedAt: Date | null;
  dispatchedAt: Date | null;
  readyForCollectionAt: Date | null;
  possessionAt: Date | null;
  cancelledAt: Date | null;
};

export type OrderRefundRecord = {
  amountPence: number;
  source: "admin" | "cancellation" | "stripe_dashboard";
  status: "pending" | "succeeded";
  requestedAt: Date;
  /** When Stripe confirmed it; null while pending. */
  refundedAt: Date | null;
};

export type OrderRecord = {
  orderId: string;
  /** "LAX-S-10482". */
  reference: string;
  /** "LAX-INV-000124", issued when the order was paid; null before. */
  invoiceNumber: string | null;
  status: ShopOrderStatus;
  fulfilment: ShopFulfilmentOption;
  merchandiseSubtotalPence: number;
  fulfilmentSurchargePence: number;
  /** VAT included in the delivery charge, as stored; null when no VAT was recorded. */
  fulfilmentVatPence: number | null;
  totalPence: number;
  /** Sum of refunds Stripe has confirmed for this order. */
  refundedPence: number;
  lines: OrderLineRecord[];
  createdAt: Date;
  paidAt: Date | null;
  checkoutExpiresAt: Date | null;
  /** When the cancellation period ends; null until delivery or collection is recorded. */
  refundPeriodEndsAt: Date | null;
  deliveryAddress: ShopDeliveryAddressRecord | null;
  progress: OrderProgressRecord | null;
  /** Pending and confirmed refunds, oldest first. Failed and withdrawn ones are left out. */
  refunds: OrderRefundRecord[];
  /** When the shopper reported a problem on this order, oldest first. */
  problemReports: Date[];
};

export const DEFAULT_ORDER_LIST_LIMIT = 50;
export const MAX_ORDER_LIST_LIMIT = 50;

export type ListOrdersInput = {
  limit: number;
  cursor?: CatalogueCursor | null;
};

export type ListOrdersResult = {
  items: OrderRecord[];
  nextCursor?: CatalogueCursor;
};

export type UpsertBasketLineInput =
  | { owner: BasketOwner; artworkSlug: string; quantity: number }
  | { owner: BasketOwner; productVariantId: string; quantity: number };

export interface BasketRepository {
  getBasket(owner: BasketOwner): Promise<BasketRecord | null>;
  addOrUpdateLine(input: UpsertBasketLineInput): Promise<BasketRecord>;
  removeLine(input: { owner: BasketOwner; lineId: string }): Promise<BasketRecord>;
  /** A line in both baskets keeps the larger quantity, so signing in never doubles a limited edition. */
  mergeBaskets(input: {
    from: BasketOwner;
    to: { kind: "subject"; identitySubjectId: string };
  }): Promise<BasketRecord>;
}

export interface CheckoutWriter {
  createCheckoutOrder(input: CheckoutOrderInput): Promise<CheckoutOrderResult>;
  resumeCheckoutOrder(input: {
    subject: string;
    orderId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutOrderResult>;
  cancelCheckoutOrder(input: { subject: string; orderId: string }): Promise<void>;
}

export interface OrderReader {
  listOrders(subject: string, input: ListOrdersInput): Promise<ListOrdersResult>;
  getOrder(subject: string, orderId: string): Promise<OrderRecord | null>;
  /** The buyer's name and email from their LAX profile, for the invoice. */
  getCustomerProfile(subject: string): Promise<{ name: string | null; email: string | null }>;
}

export type CommerceRepository = BasketRepository & CheckoutWriter & OrderReader;

export type HostedCheckoutLineItem = {
  title: string;
  description: string;
  quantity: number;
  unitAmountPence: number;
  imageUrl?: string | null;
};

export interface PaymentCheckoutGateway {
  createHostedCheckout(input: {
    orderId: string;
    /** "LAX-S-10482"; recorded in the session and payment metadata for staff. */
    orderReference?: string;
    totalPence: number;
    successUrl: string;
    cancelUrl: string;
    expiresAt: Date;
    lines: HostedCheckoutLineItem[];
    fulfilmentSurchargePence: number;
    customerEmail?: string | null;
    /** Distinguishes a replacement session for the same order (after a repricing). */
    sessionRevision?: string;
  }): Promise<{ checkoutUrl: string; sessionId: string; paymentIntentId: string | null }>;
  resolveHostedCheckout(input: {
    orderId: string;
    sessionId: string;
  }): Promise<{ checkoutUrl: string }>;
  expireHostedCheckout(input: {
    orderId: string;
    sessionId: string;
  }): Promise<
    | { kind: "expired" }
    | { kind: "already_complete" }
    | { kind: "not_expirable" }
    | { kind: "async_pending" }
  >;
}
