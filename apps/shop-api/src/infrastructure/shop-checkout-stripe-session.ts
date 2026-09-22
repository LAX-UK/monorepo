import type { Database } from "@auction/db";
import { shopOrder } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { eq } from "drizzle-orm";
import type {
  CheckoutOrderResult,
  PaymentCheckoutGateway,
} from "../application/ports/commerce.ports.js";
import { ShopApiError } from "../errors/shop-api-error.js";

export async function resolveOrCreateStripeCheckoutSession(
  db: Database,
  paymentGateway: PaymentCheckoutGateway,
  input: {
    orderId: string;
    totalPence: number;
    successUrl: string;
    cancelUrl: string;
    checkoutExpiresAt: Date;
    needsStripeSession: boolean;
    existingSessionId: string | null;
    existingCheckoutExpiresAt: Date | null;
  },
): Promise<CheckoutOrderResult> {
  if (input.existingSessionId && input.existingCheckoutExpiresAt) {
    const session = await paymentGateway.resolveHostedCheckout({
      orderId: input.orderId,
      sessionId: input.existingSessionId,
    });
    return {
      orderId: input.orderId,
      checkoutUrl: session.checkoutUrl,
      expiresAt: input.existingCheckoutExpiresAt,
    };
  }

  if (!input.needsStripeSession) {
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.PAYMENT_FAILED,
      "Checkout session unavailable",
      502,
    );
  }

  const session = await paymentGateway.createHostedCheckout({
    orderId: input.orderId,
    totalPence: input.totalPence,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
    expiresAt: input.checkoutExpiresAt,
  });

  await db
    .update(shopOrder)
    .set({
      stripeCheckoutSessionId: session.sessionId,
      stripePaymentIntentId: session.paymentIntentId,
      updatedAt: new Date(),
    })
    .where(eq(shopOrder.id, input.orderId));

  return {
    orderId: input.orderId,
    checkoutUrl: session.checkoutUrl,
    expiresAt: input.checkoutExpiresAt,
  };
}
