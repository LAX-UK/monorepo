import { commerceErrorMessage } from "@/lib/commerce-error-message";
import { EXPRESS_CHECKOUT_SOLD_OUT_MESSAGE, SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { z } from "zod";

/**
 * GAP-49 express checkout: what the Shop's server actions send to Shop Identity, and how each
 * answer reads to the wallet row. Pure, so the mapping is tested without a server.
 */

/** Who is paying decides the route; Shop Identity checks it again. */
export type ExpressCheckoutAudience = "account" | "guest";

/** What a page knows server-side; null when SHOP_EXPRESS_CHECKOUT is off or no key is set. */
export type ExpressCheckoutConfig = {
  publishableKey: string;
  audience: ExpressCheckoutAudience;
  basketId: string;
};

export type ExpressCheckoutStep = "start" | "shipping-address" | "confirm";

export function expressCheckoutPath(
  audience: ExpressCheckoutAudience,
  step: ExpressCheckoutStep,
): string {
  const base =
    audience === "guest"
      ? "/commerce/guest-checkout/express-checkout"
      : "/commerce/express-checkout";
  return step === "start" ? base : `${base}/${step}`;
}

export const EXPRESS_RATE_IDS = ["uk_insured_delivery", "collect_new_cavendish"] as const;
export type ExpressRateId = (typeof EXPRESS_RATE_IDS)[number];

const rateSchema = z.object({
  id: z.enum(EXPRESS_RATE_IDS),
  displayName: z.string().min(1),
  amountPence: z.number().int().min(0),
});

export type ExpressRate = z.infer<typeof rateSchema>;

const sessionSchema = z.object({
  sessionId: z.string().regex(/^cs_(test|live)_[A-Za-z0-9]+$/),
  clientSecret: z.string().min(1),
  expiresAt: z.string(),
  currency: z.literal("gbp"),
  subtotalPence: z.number().int().min(0),
  shippingRates: z.array(rateSchema).min(1),
});

export type ExpressSession = z.infer<typeof sessionSchema>;

const confirmedSchema = z.object({
  orderId: z.string().uuid(),
  returnUrl: z.string().min(1),
  expiresAt: z.string(),
});

/** One plain line when the row cannot be used; the card checkout is never affected. */
export const EXPRESS_UNAVAILABLE_MESSAGE =
  "Express checkout is unavailable right now. You can still check out as usual.";

export const EXPRESS_NOT_CHARGED_MESSAGE =
  "We couldn't set up this payment, so you have not been charged. Start again from your basket.";

export const EXPRESS_PAYMENT_FAILED_MESSAGE =
  "Your payment did not go through, so you have not been charged. Try again or check out as usual.";

export const EXPRESS_CANCELLED_MESSAGE = "Payment cancelled. You have not been charged.";

export { EXPRESS_CHECKOUT_SOLD_OUT_MESSAGE };

export type ExpressStartResult =
  | { kind: "ready"; session: ExpressSession }
  /** The flag is off on shop-api: the row is hidden, with no message. */
  | { kind: "unavailable" }
  | { kind: "error"; message: string };

export type ExpressAddressResult = { kind: "ok" } | { kind: "refused"; message: string };

export type ExpressConfirmResult =
  | { kind: "confirmed"; orderId: string }
  | { kind: "sold_out"; message: string }
  /** The Shop refused before any charge (basket changed, session ended, bind mismatch). */
  | { kind: "not_charged"; message: string }
  | { kind: "error"; message: string };

type Failure = { error?: string; code?: string; message?: string };

function failure(body: unknown): Failure {
  return body && typeof body === "object" ? (body as Failure) : {};
}

function upstreamMessage(body: Failure): string | null {
  return typeof body.message === "string" && body.message.trim() ? body.message.trim() : null;
}

export function expressStartResult(status: number, body: unknown): ExpressStartResult {
  if (status === 200) {
    const parsed = sessionSchema.safeParse(body);
    return parsed.success
      ? { kind: "ready", session: parsed.data }
      : { kind: "error", message: EXPRESS_UNAVAILABLE_MESSAGE };
  }
  if (status === 404 && failure(body).code === SHOP_API_ERROR_CODES.FEATURE_DISABLED) {
    return { kind: "unavailable" };
  }
  return { kind: "error", message: EXPRESS_UNAVAILABLE_MESSAGE };
}

export function expressAddressResult(status: number, body: unknown): ExpressAddressResult {
  if (status === 200) return { kind: "ok" };
  const answer = failure(body);
  // shop-api words the UK-only refusal for the sheet; anything else gets the generic line.
  if (status === 400 && answer.code === SHOP_API_ERROR_CODES.VALIDATION) {
    return { kind: "refused", message: upstreamMessage(answer) ?? EXPRESS_UNAVAILABLE_MESSAGE };
  }
  return { kind: "refused", message: EXPRESS_UNAVAILABLE_MESSAGE };
}

export function expressConfirmResult(status: number, body: unknown): ExpressConfirmResult {
  if (status === 200) {
    const parsed = confirmedSchema.safeParse(body);
    return parsed.success
      ? { kind: "confirmed", orderId: parsed.data.orderId }
      : { kind: "error", message: EXPRESS_UNAVAILABLE_MESSAGE };
  }
  const answer = failure(body);
  if (answer.code === SHOP_API_ERROR_CODES.OUT_OF_STOCK) {
    return { kind: "sold_out", message: EXPRESS_CHECKOUT_SOLD_OUT_MESSAGE };
  }
  if (
    answer.code === SHOP_API_ERROR_CODES.CONFLICT ||
    answer.code === SHOP_API_ERROR_CODES.BASKET_CONFLICT
  ) {
    return { kind: "not_charged", message: upstreamMessage(answer) ?? EXPRESS_NOT_CHARGED_MESSAGE };
  }
  if (status >= 500 || answer.error === "invalid_upstream") {
    return { kind: "error", message: EXPRESS_UNAVAILABLE_MESSAGE };
  }
  return { kind: "error", message: commerceErrorMessage(answer, EXPRESS_UNAVAILABLE_MESSAGE) };
}

/** Where the shopper lands once Stripe confirms the payment: the existing confirmation page. */
export function expressConfirmationHref(orderId: string): string {
  return `/checkout/confirmation?orderId=${encodeURIComponent(orderId)}`;
}
