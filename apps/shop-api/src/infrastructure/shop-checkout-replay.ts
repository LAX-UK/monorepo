import { randomUUID } from "node:crypto";
import type { Database } from "@auction/db";
import { shopOrder } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import {
  type ShopFulfilmentOption,
  computeOrderTotal,
  fulfilmentSurchargePence,
  pence,
} from "@auction/shop-domain";
import { eq } from "drizzle-orm";
import type {
  PaymentCheckoutGateway,
  ShopDeliveryAddress,
} from "../application/ports/commerce.ports.js";
import { ShopApiError } from "../errors/shop-api-error.js";
import { assertReplayableCheckoutOrder } from "./shop-checkout-order-validation.js";
import {
  assertCheckoutNotAlreadyPaid,
  assertCheckoutNotAsyncPending,
  expireHostedCheckoutSession,
} from "./shop-checkout-stripe-expiry.js";

/** Everything about delivery a checkout request carries, as the order stores it. */
export type CheckoutDeliveryDetails = {
  fulfilment: ShopFulfilmentOption;
  recipientName: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  phone: string | null;
};

export function checkoutDeliveryDetails(input: {
  fulfilment: ShopFulfilmentOption;
  deliveryAddress?: ShopDeliveryAddress | undefined;
  deliveryPhone?: string | undefined;
}): CheckoutDeliveryDetails {
  const address = input.deliveryAddress;
  const text = (value: string | undefined) => value?.trim() || null;
  return {
    fulfilment: input.fulfilment,
    recipientName: text(address?.recipientName),
    line1: text(address?.line1),
    line2: text(address?.line2),
    city: text(address?.city),
    postcode: text(address?.postcode),
    country: text(address?.country),
    phone: text(input.deliveryPhone),
  };
}

/** The order columns for a set of delivery details. */
export function deliveryColumns(details: CheckoutDeliveryDetails) {
  return {
    deliveryRecipientName: details.recipientName,
    deliveryLine1: details.line1,
    deliveryLine2: details.line2,
    deliveryCity: details.city,
    deliveryPostcode: details.postcode,
    deliveryCountry: details.country,
    deliveryPhone: details.phone,
  };
}

type OrderRow = typeof shopOrder.$inferSelect;

function sameDelivery(row: OrderRow, details: CheckoutDeliveryDetails): boolean {
  const stored = deliveryColumns(details);
  return (
    row.fulfilment === details.fulfilment &&
    (Object.keys(stored) as Array<keyof typeof stored>).every(
      (column) => (row[column] ?? null) === stored[column],
    )
  );
}

export type ReplayedCheckout = {
  orderId: string;
  totalPence: number;
  checkoutExpiresAt: Date;
  needsStripeSession: boolean;
  /** Set when the order needs a fresh payment session, so the payment provider opens a new one. */
  sessionRevision?: string;
};

/**
 * Returns to the pending order already created under this idempotency key.
 *
 * An unchanged retry (a double click, a slow redirect) gets the same order and payment session.
 * When the delivery details changed, the order is brought up to date before it is returned, so
 * the order that is paid always holds what the shopper last submitted:
 * - a new address, recipient or phone is written to the order; the amount is unchanged, so the
 *   open payment session stays valid and now pays for the updated order;
 * - a new delivery choice changes the amount, so the open payment session is expired first
 *   (refused if it has already been paid), the order is repriced and a new session is opened.
 *   A completion for the old session no longer matches the order and is rejected.
 */
export async function replayCheckoutOrder(
  db: Database,
  paymentGateway: PaymentCheckoutGateway,
  existing: OrderRow,
  input: { subject: string; details: CheckoutDeliveryDetails; checkoutExpiresAt: Date },
): Promise<ReplayedCheckout> {
  assertReplayableCheckoutOrder(existing, { subject: input.subject });
  const expiresAt = existing.checkoutExpiresAt ?? input.checkoutExpiresAt;
  if (sameDelivery(existing, input.details)) {
    return {
      orderId: existing.id,
      totalPence: existing.totalPence,
      checkoutExpiresAt: expiresAt,
      needsStripeSession: !existing.stripeCheckoutSessionId,
    };
  }

  const repriced = existing.fulfilment !== input.details.fulfilment;
  const surcharge = fulfilmentSurchargePence(input.details.fulfilment);
  const total = computeOrderTotal({
    merchandiseSubtotalPence: pence(existing.merchandiseSubtotalPence),
    fulfilment: input.details.fulfilment,
  });

  if (repriced && existing.stripeCheckoutSessionId) {
    const outcome = await expireHostedCheckoutSession(paymentGateway, {
      orderId: existing.id,
      sessionId: existing.stripeCheckoutSessionId,
    });
    assertCheckoutNotAlreadyPaid(outcome);
    assertCheckoutNotAsyncPending(outcome);
  }

  await db.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(shopOrder)
      .where(eq(shopOrder.id, existing.id))
      .for("update")
      .limit(1);
    if (
      !locked ||
      locked.status !== "pending_payment" ||
      locked.stripeCheckoutSessionId !== existing.stripeCheckoutSessionId
    ) {
      throw new ShopApiError(
        SHOP_API_ERROR_CODES.CONFLICT,
        "Checkout changed while updating it. Try again.",
        409,
      );
    }
    await tx
      .update(shopOrder)
      .set({
        ...deliveryColumns(input.details),
        ...(repriced
          ? {
              fulfilment: input.details.fulfilment,
              fulfilmentSurchargePence: surcharge,
              totalPence: total,
              stripeCheckoutSessionId: null,
              stripePaymentIntentId: null,
            }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(shopOrder.id, existing.id));
  });

  return {
    orderId: existing.id,
    totalPence: repriced ? total : existing.totalPence,
    checkoutExpiresAt: expiresAt,
    needsStripeSession: repriced || !existing.stripeCheckoutSessionId,
    ...(repriced ? { sessionRevision: randomUUID() } : {}),
  };
}
