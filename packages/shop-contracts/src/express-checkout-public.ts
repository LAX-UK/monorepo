import { type Static, Type } from "@sinclair/typebox";
import { ShopDeliveryAddressSchema } from "./commerce-public.js";

/**
 * GAP-49 express checkout (Apple Pay, Google Pay and Link through Stripe's Express Checkout
 * Element). The wallet sheet offers two UK rates, named by the fulfilment they become on the
 * order; international delivery and quotes stay on the Details form.
 */
export const ExpressShippingRateIdSchema = Type.Union([
  Type.Literal("uk_insured_delivery"),
  Type.Literal("collect_new_cavendish"),
]);

export type ExpressShippingRateId = Static<typeof ExpressShippingRateIdSchema>;

export const ExpressShippingRateSchema = Type.Object(
  {
    id: ExpressShippingRateIdSchema,
    displayName: Type.String({ minLength: 1 }),
    /** Tax-inclusive, in pence. Collection is a zero-price rate. */
    amountPence: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export type ExpressShippingRate = Static<typeof ExpressShippingRateSchema>;

/** A Stripe Checkout Session id, as Stripe issues it. */
export const StripeCheckoutSessionIdSchema = Type.String({
  minLength: 8,
  maxLength: 255,
  pattern: "^cs_(test|live)_[A-Za-z0-9]+$",
});

export const ExpressCheckoutStartRequestSchema = Type.Object(
  { basketId: Type.String({ format: "uuid" }) },
  { additionalProperties: false },
);

export type ExpressCheckoutStartRequest = Static<typeof ExpressCheckoutStartRequestSchema>;

/**
 * An Elements-mode Checkout Session for the basket as it is now. Nothing is ordered or held yet:
 * the order and its print hold are made only when the shopper confirms in the wallet sheet.
 */
export const ExpressCheckoutSessionSchema = Type.Object(
  {
    sessionId: StripeCheckoutSessionIdSchema,
    /** For `stripe.initCheckout({ clientSecret })`; never stored or logged. */
    clientSecret: Type.String({ minLength: 1 }),
    expiresAt: Type.String({ format: "date-time" }),
    currency: Type.Literal("gbp"),
    /** The goods and any framing, in pence, before delivery. */
    subtotalPence: Type.Integer({ minimum: 0 }),
    shippingRates: Type.Array(ExpressShippingRateSchema, { minItems: 1 }),
  },
  { additionalProperties: false },
);

export type ExpressCheckoutSession = Static<typeof ExpressCheckoutSessionSchema>;

/**
 * The address the wallet reports while the sheet is open. Wallets hide the street until the
 * shopper confirms, so only the country, and the postcode or town when given, are sent.
 */
export const ExpressShippingAddressChangeRequestSchema = Type.Object(
  {
    basketId: Type.String({ format: "uuid" }),
    sessionId: StripeCheckoutSessionIdSchema,
    address: Type.Object(
      {
        country: Type.String({ minLength: 2, maxLength: 2 }),
        postcode: Type.Optional(Type.String({ maxLength: 16 })),
        city: Type.Optional(Type.String({ maxLength: 200 })),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

export type ExpressShippingAddressChangeRequest = Static<
  typeof ExpressShippingAddressChangeRequestSchema
>;

export const ExpressShippingRatesSchema = Type.Object(
  { shippingRates: Type.Array(ExpressShippingRateSchema, { minItems: 1 }) },
  { additionalProperties: false },
);

const expressConfirmFields = {
  basketId: Type.String({ format: "uuid" }),
  sessionId: StripeCheckoutSessionIdSchema,
  shippingRateId: ExpressShippingRateIdSchema,
  /** The name from the wallet: the recipient for delivery, the collector for collection. */
  name: Type.String({ minLength: 1, maxLength: 200 }),
  /** Required for insured delivery, as on the Details form. */
  phone: Type.Optional(
    Type.String({ minLength: 8, maxLength: 20, pattern: "^\\+?[0-9][0-9 ()-]{6,19}$" }),
  ),
  /**
   * The full UK address the wallet gives on confirm. Stripe needs it on the session for either
   * rate; the order keeps it only for insured delivery.
   */
  shippingAddress: ShopDeliveryAddressSchema,
};

/** The shopper confirmed in the wallet sheet: make the order and hold its prints. */
export const ExpressCheckoutConfirmRequestSchema = Type.Object(expressConfirmFields, {
  additionalProperties: false,
});

export type ExpressCheckoutConfirmRequest = Static<typeof ExpressCheckoutConfirmRequestSchema>;

export const GuestExpressCheckoutConfirmRequestSchema = Type.Object(
  {
    ...expressConfirmFields,
    email: Type.String({ minLength: 3, maxLength: 254 }),
    marketingConsent: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export type GuestExpressCheckoutConfirmRequest = Static<
  typeof GuestExpressCheckoutConfirmRequestSchema
>;

const expressConfirmedFields = {
  orderId: Type.String({ format: "uuid" }),
  /** Where the shopper lands once Stripe confirms the payment. */
  returnUrl: Type.String({ minLength: 1 }),
  /** When the print hold ends if the payment is not completed. */
  expiresAt: Type.String({ format: "date-time" }),
};

export const ExpressCheckoutConfirmedSchema = Type.Object(expressConfirmedFields, {
  additionalProperties: false,
});

export type ExpressCheckoutConfirmed = Static<typeof ExpressCheckoutConfirmedSchema>;

export const GuestExpressCheckoutConfirmedSchema = Type.Object(
  {
    ...expressConfirmedFields,
    orderAccessToken: Type.String({ minLength: 43, maxLength: 43 }),
    orderAccessExpiresAt: Type.String({ format: "date-time" }),
  },
  { additionalProperties: false },
);

export type GuestExpressCheckoutConfirmed = Static<typeof GuestExpressCheckoutConfirmedSchema>;

/** What a confirm says when a print in the basket sold while the sheet was open. */
export const EXPRESS_CHECKOUT_SOLD_OUT_MESSAGE = "This print has just sold out";
