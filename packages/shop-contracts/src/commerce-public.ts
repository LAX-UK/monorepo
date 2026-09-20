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
    line1: Type.String({ minLength: 1 }),
    line2: Type.Optional(Type.String()),
    city: Type.String({ minLength: 1 }),
    postcode: Type.String({ minLength: 1 }),
    country: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export type ShopDeliveryAddress = Static<typeof ShopDeliveryAddressSchema>;

export const BasketLineSchema = Type.Object(
  {
    lineId: Type.String({ format: "uuid" }),
    artworkSlug: Type.String({ minLength: 1 }),
    artworkTitle: Type.String({ minLength: 1 }),
    unitPricePence: Type.Integer({ minimum: 0 }),
    quantity: Type.Integer({ minimum: 1 }),
    sellableCount: Type.Integer({ minimum: 0 }),
    priceChanged: Type.Boolean(),
    outOfStock: Type.Boolean(),
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
    artworkSlug: Type.String({ minLength: 1 }),
    artworkTitle: Type.String({ minLength: 1 }),
    editionNumber: Type.Integer({ minimum: 1, maximum: 24 }),
    unitPricePence: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export const OrderSummarySchema = Type.Object(
  {
    orderId: Type.String({ format: "uuid" }),
    status: Type.Union([
      Type.Literal("pending_payment"),
      Type.Literal("paid"),
      Type.Literal("cancelled"),
      Type.Literal("expired"),
      Type.Literal("payment_failed"),
    ]),
    fulfilment: ShopFulfilmentOptionSchema,
    merchandiseSubtotalPence: Type.Integer({ minimum: 0 }),
    fulfilmentSurchargePence: Type.Integer({ minimum: 0 }),
    totalPence: Type.Integer({ minimum: 0 }),
    lines: Type.Array(OrderLineSchema),
    createdAt: Type.String({ format: "date-time" }),
    paidAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
    deliveryAddress: Type.Union([ShopDeliveryAddressSchema, Type.Null()]),
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
export type OrderSummary = typeof OrderSummarySchema.static;
export type OrderList = typeof OrderListSchema.static;
export type CheckoutSession = typeof CheckoutSessionSchema.static;
