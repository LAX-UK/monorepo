import type { ShopFulfilmentOption } from "@auction/shop-domain";
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
};

export type BasketRecord = {
  basketId: string;
  owner: BasketOwner;
  expiresAt: Date;
  lines: BasketLineRecord[];
};

export type ShopDeliveryAddress = {
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
};

export type CheckoutOrderResult = {
  orderId: string;
  checkoutUrl: string;
  expiresAt: Date;
};

export type ShopDeliveryAddressRecord = {
  line1: string;
  line2?: string;
  city: string;
  postcode: string;
  country: string;
};

export type OrderRecord = {
  orderId: string;
  status: "pending_payment" | "paid" | "cancelled" | "expired" | "payment_failed";
  fulfilment: ShopFulfilmentOption;
  merchandiseSubtotalPence: number;
  fulfilmentSurchargePence: number;
  totalPence: number;
  lines: Array<{
    orderLineId: string;
    artworkSlug: string | null;
    artworkTitle: string | null;
    productVariantId: string | null;
    productSlug: string | null;
    productTitle: string | null;
    variantSku: string | null;
    editionNumber: number | null;
    unitPricePence: number;
  }>;
  createdAt: Date;
  paidAt: Date | null;
  deliveryAddress: ShopDeliveryAddressRecord | null;
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
    totalPence: number;
    successUrl: string;
    cancelUrl: string;
    expiresAt: Date;
    lines: HostedCheckoutLineItem[];
    fulfilmentSurchargePence: number;
    customerEmail?: string | null;
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
