import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import type { ShopFulfilmentOption } from "@auction/shop-domain";
import { ShopApiError } from "../errors/shop-api-error.js";

export type ExistingCheckoutOrderRow = {
  id: string;
  identitySubjectId: string;
  fulfilment: ShopFulfilmentOption;
  status: string;
  checkoutExpiresAt: Date | null;
  stripeCheckoutSessionId: string | null;
  totalPence: number;
};

/**
 * An order found under the request's idempotency key can be returned to (or brought up to date
 * with the request's delivery details) only while it is the same shopper's unpaid, unexpired
 * order. A different delivery choice is not a reason to refuse: the replay updates the order.
 */
export function assertReplayableCheckoutOrder(
  existing: ExistingCheckoutOrderRow,
  input: { subject: string },
): void {
  if (existing.identitySubjectId !== input.subject) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.FORBIDDEN, "Order ownership mismatch", 403);
  }
  if (existing.status === "paid") {
    throw new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, "Order already paid", 409);
  }
  if (existing.status !== "pending_payment") {
    throw new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, "Order is no longer checkoutable", 409);
  }
  if (existing.checkoutExpiresAt && existing.checkoutExpiresAt < new Date()) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, "Checkout session expired", 409);
  }
}
