import type { ShopFulfilmentOption } from "@auction/shop-domain";
import type { CatalogueCursor } from "../catalogue-cursor.js";

export type BasketOwner =
  | { kind: "anonymous"; tokenHash: string }
  | { kind: "subject"; identitySubjectId: string };

export type BasketLineRecord = {
  lineId: string;
  artworkId: string;
  artworkSlug: string;
  artworkTitle: string;
  unitPricePence: number;
  livePricePence: number | null;
  quantity: number;
  sellableCount: number;
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
    artworkSlug: string;
    artworkTitle: string;
    editionNumber: number;
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

export interface BasketRepository {
  getBasket(owner: BasketOwner): Promise<BasketRecord | null>;
  addOrUpdateLine(input: {
    owner: BasketOwner;
    artworkSlug: string;
    quantity: number;
  }): Promise<BasketRecord>;
  removeLine(input: { owner: BasketOwner; lineId: string }): Promise<BasketRecord>;
  mergeBaskets(input: {
    from: BasketOwner;
    to: { kind: "subject"; identitySubjectId: string };
  }): Promise<BasketRecord>;
}

export interface CheckoutWriter {
  createCheckoutOrder(input: CheckoutOrderInput): Promise<CheckoutOrderResult>;
}

export interface OrderReader {
  listOrders(subject: string, input: ListOrdersInput): Promise<ListOrdersResult>;
  getOrder(subject: string, orderId: string): Promise<OrderRecord | null>;
}

export type CommerceRepository = BasketRepository & CheckoutWriter & OrderReader;

export interface PaymentCheckoutGateway {
  createHostedCheckout(input: {
    orderId: string;
    totalPence: number;
    successUrl: string;
    cancelUrl: string;
    expiresAt: Date;
  }): Promise<{ checkoutUrl: string; sessionId: string; paymentIntentId: string | null }>;
  resolveHostedCheckout(input: {
    orderId: string;
    sessionId: string;
  }): Promise<{ checkoutUrl: string }>;
}
