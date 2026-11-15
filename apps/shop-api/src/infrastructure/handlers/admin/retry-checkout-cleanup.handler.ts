import { shopOrder } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { isHeldOutOfCheckoutSweep } from "@auction/shop-domain";
import { eq } from "drizzle-orm";
import { withAdminIdempotency } from "../../../application/admin/with-admin-idempotency.js";
import type { ShopUnitOfWorkFactory } from "../../../application/ports/shop-unit-of-work.js";
import { ShopApiError, notFound } from "../../../errors/shop-api-error.js";
import { shopPhaseDbSession } from "../../drizzle-shop-transaction-effects.js";

export type RetryCheckoutCleanupCommand = {
  orderId: string;
  actorSubjectId: string;
  idempotencyKey: string;
  now?: Date;
};

export type RetryCheckoutCleanupResult = { orderId: string; status: "pending_payment" };

/**
 * Puts an order the checkout sweep gave up on back in the sweep. Its hold is set to now, so the
 * next sweep settles it as it would any order: asks Stripe, then applies, closes or expires it.
 * Nothing is released here, so an order that still cannot be settled is taken out again, with a
 * new alert to ops for that attempt (see takeOrderOutOfSweep), and its prints stay reserved. Refused for any order the sweep still has.
 */
export function createRetryCheckoutCleanupHandler(deps: {
  uow: ShopUnitOfWorkFactory;
}): (command: RetryCheckoutCleanupCommand) => Promise<RetryCheckoutCleanupResult> {
  return async (command) => {
    const now = command.now ?? new Date();
    return deps.uow.run(async (tx) =>
      withAdminIdempotency({
        tx,
        commandType: "checkout.retry_cleanup",
        idempotencyKey: command.idempotencyKey,
        actorSubjectId: command.actorSubjectId,
        requestPayload: { orderId: command.orderId },
        run: async () => {
          const db = shopPhaseDbSession(tx);
          const [order] = await db
            .select({
              id: shopOrder.id,
              reference: shopOrder.reference,
              status: shopOrder.status,
              checkoutExpiresAt: shopOrder.checkoutExpiresAt,
              reaperDeferrals: shopOrder.reaperDeferrals,
            })
            .from(shopOrder)
            .where(eq(shopOrder.id, command.orderId))
            .for("update")
            .limit(1);
          if (!order) throw notFound("Order");
          if (!isHeldOutOfCheckoutSweep(order)) {
            throw new ShopApiError(
              SHOP_API_ERROR_CODES.CONFLICT,
              "This order is not held out of the checkout clean-up",
              409,
            );
          }
          await db
            .update(shopOrder)
            .set({ checkoutExpiresAt: now, updatedAt: now })
            .where(eq(shopOrder.id, order.id));
          await tx.audit.append({
            actorSubjectId: command.actorSubjectId,
            capability: "order.write",
            action: "retry_checkout_cleanup",
            targetType: "shop_order",
            targetId: order.id,
            afterJson: { reference: order.reference, deferrals: order.reaperDeferrals },
          });
          return { orderId: order.id, status: "pending_payment" as const };
        },
      }),
    );
  };
}
