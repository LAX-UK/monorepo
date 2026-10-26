import { type Static, Type } from "@sinclair/typebox";

export const ShopFulfilmentOptionSchema = Type.Union([
  Type.Literal("uk_insured_delivery"),
  Type.Literal("collect_new_cavendish"),
  Type.Literal("collect_brunswick"),
  Type.Literal("lax_storage"),
  Type.Literal("international_quotation"),
]);

export type ShopFulfilmentOption = Static<typeof ShopFulfilmentOptionSchema>;

export const ShopDeliveryAddressSchema = Type.Object(
  {
    /** Who the parcel is for; absent from orders placed before checkout asked for it. */
    recipientName: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
    line1: Type.String({ minLength: 1 }),
    line2: Type.Optional(Type.String()),
    city: Type.String({ minLength: 1 }),
    postcode: Type.String({ minLength: 1 }),
    country: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export type ShopDeliveryAddress = Static<typeof ShopDeliveryAddressSchema>;

/**
 * An address from the person's LAX Account address book, as checkout offers it. Only the fields
 * a delivery needs are passed on; the book itself is managed in LAX Account.
 */
export const SavedDeliveryAddressSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    label: Type.String(),
    recipientName: Type.String(),
    line1: Type.String(),
    line2: Type.Union([Type.String(), Type.Null()]),
    city: Type.String(),
    postcode: Type.String(),
    /** ISO 3166-1 alpha-2. Online checkout delivers to GB only. */
    country: Type.String({ minLength: 2, maxLength: 2 }),
    phone: Type.Union([Type.String(), Type.Null()]),
    isDefaultShipping: Type.Boolean(),
  },
  { additionalProperties: false },
);

/** `available` is false when the address book could not be read; checkout then asks for entry. */
export const SavedDeliveryAddressListSchema = Type.Object(
  {
    available: Type.Boolean(),
    addresses: Type.Array(SavedDeliveryAddressSchema),
  },
  { additionalProperties: false },
);

export type SavedDeliveryAddress = Static<typeof SavedDeliveryAddressSchema>;
export type SavedDeliveryAddressList = Static<typeof SavedDeliveryAddressListSchema>;

export const BasketLineSchema = Type.Object(
  {
    lineId: Type.String({ format: "uuid" }),
    artworkSlug: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    artworkTitle: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    productVariantId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
    productSlug: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    productTitle: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    variantSku: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    unitPricePence: Type.Integer({ minimum: 0 }),
    quantity: Type.Integer({ minimum: 1 }),
    /** No stock at all; how much is left is never public. */
    soldOut: Type.Boolean(),
    priceChanged: Type.Boolean(),
    outOfStock: Type.Boolean(),
    imageUrl: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    // The fields below are optional so a storefront parses responses from an older shop-api.
    artistName: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()])),
    artistSlug: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()])),
    /** The size of the edition run ("Limited edition of 24"); null for merchandise. */
    editionSize: Type.Optional(Type.Union([Type.Integer({ minimum: 1 }), Type.Null()])),
    /** Copies of this item one order may hold ("Limit 2 per order"); null when only stock limits it. */
    orderLimit: Type.Optional(Type.Union([Type.Integer({ minimum: 1 }), Type.Null()])),
    /**
     * The most this line can hold now: the per-order limit, lowered to what can be sold. It is a
     * cap for the stepper, not a stock figure, and is never shown as a number of copies left.
     */
    maxQuantity: Type.Optional(Type.Integer({ minimum: 1 })),
  },
  { additionalProperties: false },
);

export const EmptyBasketViewSchema = Type.Object(
  {
    basketId: Type.Null(),
    lines: Type.Array(BasketLineSchema),
    merchandiseSubtotalPence: Type.Integer({ minimum: 0 }),
    expiresAt: Type.Null(),
  },
  { additionalProperties: false },
);

export const BasketViewSchema = Type.Object(
  {
    basketId: Type.String({ format: "uuid" }),
    lines: Type.Array(BasketLineSchema),
    merchandiseSubtotalPence: Type.Integer({ minimum: 0 }),
    expiresAt: Type.String({ format: "date-time" }),
  },
  { additionalProperties: false },
);

export const BasketResponseSchema = Type.Union([BasketViewSchema, EmptyBasketViewSchema]);

export const OrderLineSchema = Type.Object(
  {
    orderLineId: Type.String({ format: "uuid" }),
    artworkSlug: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    artworkTitle: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    productVariantId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
    productSlug: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    productTitle: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    variantSku: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    /**
     * The edition this line holds. Only set while a paid order holds it: an unpaid, cancelled or
     * refunded line never names one. Bounded by the edition size, not by a fixed number.
     */
    editionNumber: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
    unitPricePence: Type.Integer({ minimum: 0 }),
    /** The artwork's primary image for order lists; absent from older responses. */
    imageUrl: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()])),
    /** How many editions the run has ("Edition 3 of 24"); null for merchandise. */
    editionSize: Type.Optional(Type.Union([Type.Integer({ minimum: 1 }), Type.Null()])),
    artistName: Type.Optional(Type.Union([Type.String({ minLength: 1 }), Type.Null()])),
  },
  { additionalProperties: false },
);

const NullableDateTime = Type.Union([Type.String({ format: "date-time" }), Type.Null()]);

/** Where delivery or collection stands, with the date each stage was reached when it is known. */
export const OrderProgressSchema = Type.Object(
  {
    status: Type.Union([
      Type.Literal("pending_production"),
      Type.Literal("in_production"),
      Type.Literal("awaiting_dispatch"),
      Type.Literal("in_transit"),
      Type.Literal("ready_for_collection"),
      Type.Literal("collected"),
      Type.Literal("in_storage"),
      Type.Literal("delivered"),
      Type.Literal("cancelled"),
    ]),
    carrier: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    trackingNumber: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    /** The carrier's tracking page, when its address is known for that carrier. */
    trackingUrl: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    productionStartedAt: NullableDateTime,
    dispatchedAt: NullableDateTime,
    readyForCollectionAt: NullableDateTime,
    /** When the shopper received it: delivered or collected. */
    possessionAt: NullableDateTime,
    cancelledAt: NullableDateTime,
  },
  { additionalProperties: false },
);

/** Money returned to the shopper. `cancellation` refunds follow a cancellation within 14 days. */
export const OrderRefundSchema = Type.Object(
  {
    amountPence: Type.Integer({ minimum: 0 }),
    kind: Type.Union([Type.Literal("cancellation"), Type.Literal("refund")]),
    status: Type.Union([Type.Literal("pending"), Type.Literal("succeeded")]),
    /** When it was asked for. */
    requestedAt: Type.String({ format: "date-time" }),
    /** When the money was returned; null while it is still pending. */
    refundedAt: NullableDateTime,
  },
  { additionalProperties: false },
);

/** Whether the shopper can report a problem now, and until when. */
export const OrderProblemReportWindowSchema = Type.Object(
  {
    open: Type.Boolean(),
    /** Null before delivery, when the 14 days have not started. */
    endsAt: NullableDateTime,
  },
  { additionalProperties: false },
);

export const ORDER_PROBLEM_REASONS = [
  "changed_mind",
  "damaged",
  "wrong_item",
  "not_arrived",
  "other",
] as const;

export type OrderProblemReason = (typeof ORDER_PROBLEM_REASONS)[number];

export const ORDER_PROBLEM_DETAILS_MAX_LENGTH = 2000;

export const OrderProblemReportRequestSchema = Type.Object(
  {
    reason: Type.Union(ORDER_PROBLEM_REASONS.map((reason) => Type.Literal(reason))),
    details: Type.String({ minLength: 1, maxLength: ORDER_PROBLEM_DETAILS_MAX_LENGTH }),
  },
  { additionalProperties: false },
);

export const OrderProblemReportResponseSchema = Type.Object(
  { reportId: Type.String({ format: "uuid" }) },
  { additionalProperties: false },
);

export type OrderProblemReportRequest = Static<typeof OrderProblemReportRequestSchema>;
export type OrderProgress = Static<typeof OrderProgressSchema>;
export type OrderRefund = Static<typeof OrderRefundSchema>;

/**
 * Every status an order can reach, including the two staff refunds set after payment. Kept in step
 * with `SHOP_ORDER_STATUSES` in `@auction/shop-domain`; shop-api checks the two lists agree.
 */
export const ORDER_STATUS_VALUES = [
  "pending_payment",
  "paid",
  "cancelled",
  "expired",
  "payment_failed",
  "partially_refunded",
  "refunded",
] as const;

export const OrderStatusSchema = Type.Union([
  Type.Literal("pending_payment"),
  Type.Literal("paid"),
  Type.Literal("cancelled"),
  Type.Literal("expired"),
  Type.Literal("payment_failed"),
  Type.Literal("partially_refunded"),
  Type.Literal("refunded"),
]);

export const OrderSummarySchema = Type.Object(
  {
    orderId: Type.String({ format: "uuid" }),
    status: OrderStatusSchema,
    fulfilment: ShopFulfilmentOptionSchema,
    merchandiseSubtotalPence: Type.Integer({ minimum: 0 }),
    fulfilmentSurchargePence: Type.Integer({ minimum: 0 }),
    totalPence: Type.Integer({ minimum: 0 }),
    /** Money already returned to the customer; absent from older responses, meaning none. */
    refundedPence: Type.Optional(Type.Integer({ minimum: 0 })),
    lines: Type.Array(OrderLineSchema),
    createdAt: Type.String({ format: "date-time" }),
    paidAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
    deliveryAddress: Type.Union([ShopDeliveryAddressSchema, Type.Null()]),
    // The fields below are optional so a storefront parses responses from an older shop-api.
    /** What the shopper quotes: "LAX-S-10482". */
    reference: Type.Optional(Type.String({ minLength: 1 })),
    /** Until when an unpaid order can still be paid. */
    checkoutExpiresAt: Type.Optional(NullableDateTime),
    /** VAT included in the total; null when the order recorded no VAT rate. */
    vatIncludedPence: Type.Optional(Type.Union([Type.Integer({ minimum: 0 }), Type.Null()])),
    /** The one rate every line was charged at, in basis points (2000 is 20%). */
    vatRateBp: Type.Optional(Type.Union([Type.Integer({ minimum: 1 }), Type.Null()])),
    progress: Type.Optional(Type.Union([OrderProgressSchema, Type.Null()])),
    refunds: Type.Optional(Type.Array(OrderRefundSchema)),
    problemReport: Type.Optional(OrderProblemReportWindowSchema),
    /** True once the order is paid: its invoice can be downloaded. */
    invoiceAvailable: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const CheckoutSessionSchema = Type.Object(
  {
    orderId: Type.String({ format: "uuid" }),
    checkoutUrl: Type.String({ minLength: 1 }),
    expiresAt: Type.String({ format: "date-time" }),
  },
  { additionalProperties: false },
);

export const OrderListSchema = Type.Object(
  {
    items: Type.Array(OrderSummarySchema),
    nextCursor: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export type BasketView = typeof BasketViewSchema.static;
export type EmptyBasketView = typeof EmptyBasketViewSchema.static;
export type BasketResponse = typeof BasketResponseSchema.static;
export type BasketLine = typeof BasketLineSchema.static;
export type OrderStatus = typeof OrderStatusSchema.static;
export type OrderSummary = typeof OrderSummarySchema.static;
export type OrderList = typeof OrderListSchema.static;
export type CheckoutSession = typeof CheckoutSessionSchema.static;
