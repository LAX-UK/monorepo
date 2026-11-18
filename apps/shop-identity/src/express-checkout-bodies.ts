import { z } from "zod";
import { DELIVERY_PHONE_PATTERN } from "./commerce-bodies.js";

/**
 * GAP-49 express checkout bodies, as the Shop sends them. They mirror shop-api's contract
 * (`@auction/shop-contracts` express-checkout-public) so a malformed request stops at the BFF.
 */
const stripeCheckoutSessionId = z
  .string()
  .min(8)
  .max(255)
  .regex(/^cs_(test|live)_[A-Za-z0-9]+$/);

export const expressCheckoutStartBodySchema = z.object({ basketId: z.string().uuid() }).strict();

export const expressShippingAddressBodySchema = z
  .object({
    basketId: z.string().uuid(),
    sessionId: stripeCheckoutSessionId,
    address: z
      .object({
        country: z.string().length(2),
        postcode: z.string().max(16).optional(),
        city: z.string().max(200).optional(),
      })
      .strict(),
  })
  .strict();

const expressConfirmShape = {
  basketId: z.string().uuid(),
  sessionId: stripeCheckoutSessionId,
  shippingRateId: z.enum(["uk_insured_delivery", "collect_new_cavendish"]),
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(8).max(20).regex(DELIVERY_PHONE_PATTERN).optional(),
  shippingAddress: z
    .object({
      recipientName: z.string().trim().min(1).max(200).optional(),
      line1: z.string().min(1).max(200),
      line2: z.string().max(200).optional(),
      city: z.string().min(1).max(120),
      postcode: z.string().min(1).max(32),
      country: z.string().min(2).max(2),
    })
    .strict(),
};

export const expressCheckoutConfirmBodySchema = z.object(expressConfirmShape).strict();

export const guestExpressCheckoutConfirmBodySchema = z
  .object({
    ...expressConfirmShape,
    email: z.string().trim().min(3).max(254).email(),
    marketingConsent: z.boolean().optional(),
  })
  .strict();

/** shop-api's answer to a guest confirm: the order and the token that opens it. */
export const guestExpressCheckoutConfirmedSchema = z.object({
  orderId: z.string().uuid(),
  returnUrl: z.string().min(1),
  expiresAt: z.string(),
  orderAccessToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  orderAccessExpiresAt: z.string().datetime({ offset: true }),
});
