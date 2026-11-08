import { type Static, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { ShopContractParseError } from "./parse-public.js";

/**
 * Asking for a delivery quote at checkout, for an order going outside the UK. The buyer sends the
 * basket and an address; the answer says what happens next: the print is held while the gallery
 * quotes, the region has a fixed rate and checkout goes straight to payment, or the country is
 * one the Shop does not deliver to.
 */
export const DeliveryQuoteRequestBodySchema = Type.Object(
  {
    basketId: Type.String({ format: "uuid" }),
    /** One per basket and attempt: a retry returns the same request. */
    idempotencyKey: Type.String({ minLength: 8, maxLength: 200 }),
    deliveryAddress: Type.Object(
      {
        recipientName: Type.String({ minLength: 1, maxLength: 200 }),
        line1: Type.String({ minLength: 1, maxLength: 200 }),
        line2: Type.Optional(Type.String({ maxLength: 200 })),
        city: Type.String({ minLength: 1, maxLength: 120 }),
        postcode: Type.String({ minLength: 1, maxLength: 20 }),
        /** ISO 3166-1 alpha-2, not GB. */
        country: Type.String({ minLength: 2, maxLength: 2 }),
      },
      { additionalProperties: false },
    ),
    deliveryPhone: Type.String({ minLength: 1, maxLength: 30 }),
    /** Where the buyer returns from payment; used only when the region has a fixed rate. */
    successUrl: Type.String({ minLength: 1, maxLength: 2000 }),
    cancelUrl: Type.String({ minLength: 1, maxLength: 2000 }),
  },
  { additionalProperties: false },
);
export type DeliveryQuoteRequestBody = Static<typeof DeliveryQuoteRequestBodySchema>;

const QuotedRegionIdSchema = Type.Union([
  Type.Literal("eu"),
  Type.Literal("north_america"),
  Type.Literal("asia_pacific"),
]);

export const DeliveryQuoteRequestResultSchema = Type.Union([
  /** The print is held until `holdUntil` while the gallery prices the delivery. */
  Type.Object({
    outcome: Type.Literal("quote_requested"),
    orderReference: Type.String(),
    holdUntil: Type.String({ format: "date-time" }),
    /** The region's lead-time spans in working days are on the public delivery regions. */
    regionId: Type.Union([QuotedRegionIdSchema, Type.Null()]),
    country: Type.String({ minLength: 2, maxLength: 2 }),
  }),
  /** The region has a fixed rate: pay now, with delivery in the total. */
  Type.Object({ outcome: Type.Literal("pay_now"), checkoutUrl: Type.String() }),
  /** An export-restricted country: collection is offered instead. */
  Type.Object({
    outcome: Type.Literal("not_delivered"),
    country: Type.String({ minLength: 2, maxLength: 2 }),
  }),
]);
export type DeliveryQuoteRequestResult = Static<typeof DeliveryQuoteRequestResultSchema>;

export const DeliveryQuoteRequestIssueSchema = Type.Object({
  field: Type.Union([
    Type.Literal("recipientName"),
    Type.Literal("line1"),
    Type.Literal("city"),
    Type.Literal("postcode"),
    Type.Literal("country"),
    Type.Literal("phone"),
  ]),
  reason: Type.Union([
    Type.Literal("required"),
    Type.Literal("too_long"),
    Type.Literal("unknown_country"),
    Type.Literal("united_kingdom"),
    Type.Literal("invalid_phone"),
  ]),
});
export type DeliveryQuoteRequestIssue = Static<typeof DeliveryQuoteRequestIssueSchema>;

/** A 400 that names each address field that needs another look. */
export const DeliveryQuoteRequestRejectedBodySchema = Type.Object({
  code: Type.String(),
  message: Type.String(),
  requestId: Type.Optional(Type.String()),
  issues: Type.Optional(Type.Array(DeliveryQuoteRequestIssueSchema)),
});

export function parseDeliveryQuoteRequestResult(value: unknown): DeliveryQuoteRequestResult {
  if (!Value.Check(DeliveryQuoteRequestResultSchema, value)) {
    throw new ShopContractParseError("Invalid delivery quote request payload");
  }
  return value;
}

/** A guest's request: the same, with who they are. */
export const GuestDeliveryQuoteRequestBodySchema = Type.Object(
  {
    ...DeliveryQuoteRequestBodySchema.properties,
    email: Type.String({ minLength: 3, maxLength: 320 }),
    name: Type.String({ minLength: 1, maxLength: 200 }),
    marketingConsent: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);
export type GuestDeliveryQuoteRequestBody = Static<typeof GuestDeliveryQuoteRequestBodySchema>;

export const GuestDeliveryQuoteRequestResponseSchema = Type.Object({
  result: DeliveryQuoteRequestResultSchema,
  /** Opens the order without an account; absent when no order was made. */
  orderAccessToken: Type.Optional(Type.String()),
  orderAccessExpiresAt: Type.Optional(Type.String({ format: "date-time" })),
});
export type GuestDeliveryQuoteRequestResponse = Static<
  typeof GuestDeliveryQuoteRequestResponseSchema
>;
