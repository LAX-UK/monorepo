import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import type { PaymentCheckoutGateway } from "../application/ports/commerce.ports.js";
import { ShopApiError } from "../errors/shop-api-error.js";

export type StripeExpiryOutcome =
  | { kind: "expired" }
  | { kind: "already_complete" }
  | { kind: "not_expirable" }
  | { kind: "async_pending" };

export async function expireHostedCheckoutSession(
  paymentGateway: PaymentCheckoutGateway,
  input: { orderId: string; sessionId: string | null },
): Promise<StripeExpiryOutcome> {
  if (!input.sessionId) {
    return { kind: "not_expirable" };
  }
  return paymentGateway.expireHostedCheckout({
    orderId: input.orderId,
    sessionId: input.sessionId,
  });
}

export function assertCheckoutNotAlreadyPaid(outcome: StripeExpiryOutcome): void {
  if (outcome.kind === "already_complete") {
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.CONFLICT,
      "Payment already completed for this order",
      409,
    );
  }
}

export function assertCheckoutNotAsyncPending(outcome: StripeExpiryOutcome): void {
  if (outcome.kind === "async_pending") {
    throw new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, "Payment in progress", 409);
  }
}

export function isAsyncCheckoutPaymentPending(outcome: StripeExpiryOutcome): boolean {
  return outcome.kind === "async_pending";
}
