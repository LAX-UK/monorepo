import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import {
  OrderSummarySchema,
  ShopDeliveryAddressSchema,
  ShopFulfilmentOptionSchema,
} from "./commerce-public.js";

/** The email step at checkout without an account. */
export const GuestEmailCheckRequestSchema = Type.Object(
  {
    email: Type.String({ minLength: 3, maxLength: 254 }),
    /** The separate, unticked opt-in to Shop news; transactional email never depends on it. */
    marketingConsent: Type.Optional(Type.Boolean()),
    /** Honeypot: left empty by people, filled by form bots. */
    website: Type.Optional(Type.String({ maxLength: 200 })),
  },
  { additionalProperties: false },
);

/** `sign_in_required`: the email belongs to a LAX account, so the person signs in instead. */
export const GuestEmailCheckResponseSchema = Type.Object(
  {
    outcome: Type.Union([Type.Literal("continue_as_guest"), Type.Literal("sign_in_required")]),
  },
  { additionalProperties: false },
);

export const GuestCheckoutRequestSchema = Type.Object(
  {
    basketId: Type.String({ format: "uuid" }),
    email: Type.String({ minLength: 3, maxLength: 254 }),
    name: Type.String({ minLength: 1, maxLength: 200 }),
    marketingConsent: Type.Optional(Type.Boolean()),
    fulfilment: ShopFulfilmentOptionSchema,
    idempotencyKey: Type.String({ minLength: 8, maxLength: 128 }),
    successUrl: Type.String({ minLength: 1 }),
    cancelUrl: Type.String({ minLength: 1 }),
    deliveryAddress: Type.Optional(ShopDeliveryAddressSchema),
    deliveryPhone: Type.Optional(
      Type.String({ minLength: 8, maxLength: 20, pattern: "^\\+?[0-9][0-9 ()-]{6,19}$" }),
    ),
  },
  { additionalProperties: false },
);

/** The payment page, and the token that opens the order without an account afterwards. */
export const GuestCheckoutSessionSchema = Type.Object(
  {
    orderId: Type.String({ format: "uuid" }),
    checkoutUrl: Type.String({ minLength: 1 }),
    expiresAt: Type.String({ format: "date-time" }),
    orderAccessToken: Type.String({ minLength: 43, maxLength: 43 }),
    orderAccessExpiresAt: Type.String({ format: "date-time" }),
  },
  { additionalProperties: false },
);

export const GuestOrderLinkRequestSchema = Type.Object(
  { token: Type.String({ minLength: 1, maxLength: 128 }) },
  { additionalProperties: false },
);

/**
 * A guest order opened from its link. `expired` and `claimed` say what happened without showing
 * the order: a claimed order now lives in the LAX account that verified the email.
 */
export const GuestOrderViewSchema = Type.Union([
  Type.Object(
    {
      state: Type.Literal("valid"),
      order: OrderSummarySchema,
      email: Type.String(),
      linkExpiresAt: Type.String({ format: "date-time" }),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      state: Type.Union([Type.Literal("expired"), Type.Literal("claimed")]),
      orderReference: Type.String(),
    },
    { additionalProperties: false },
  ),
]);

/** Ask for a new link; the answer never says whether the order and email matched. */
export const GuestOrderLinkResendRequestSchema = Type.Object(
  {
    email: Type.String({ minLength: 3, maxLength: 254 }),
    orderReference: Type.String({ minLength: 3, maxLength: 40 }),
  },
  { additionalProperties: false },
);

export type GuestEmailCheckRequest = typeof GuestEmailCheckRequestSchema.static;
export type GuestEmailCheckResponse = typeof GuestEmailCheckResponseSchema.static;
export type GuestCheckoutRequest = typeof GuestCheckoutRequestSchema.static;
export type GuestCheckoutSession = typeof GuestCheckoutSessionSchema.static;
export type GuestOrderView = typeof GuestOrderViewSchema.static;
export type GuestOrderLinkResendRequest = typeof GuestOrderLinkResendRequestSchema.static;

export function parseGuestEmailCheckResponse(value: unknown): GuestEmailCheckResponse | null {
  return Value.Check(GuestEmailCheckResponseSchema, value) ? value : null;
}

export function parseGuestCheckoutSession(value: unknown): GuestCheckoutSession | null {
  return Value.Check(GuestCheckoutSessionSchema, value) ? value : null;
}

export function parseGuestOrderView(value: unknown): GuestOrderView | null {
  return Value.Check(GuestOrderViewSchema, value) ? value : null;
}
