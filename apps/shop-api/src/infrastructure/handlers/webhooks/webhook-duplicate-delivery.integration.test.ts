import type { Database } from "@auction/db";
import { shopDispute, shopOrder, shopProcessedPaymentEvent, shopRefund } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ShopNotificationPublisher } from "../../../application/ports/shop-notification.publisher.js";
import type { StripeMoneyWebhookOutcome } from "../../../application/ports/stripe-money-webhook.types.js";
import { claimIsBlockedOnLock } from "../../../test-support/claim-lock-wait.js";
import { setupShopCheckout } from "../../../test-support/shop-checkout-harness.js";
import {
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../../../test-support/shop-integration-setup.js";
import { completeRefundFromWebhook } from "./complete-refund.handler.js";
import { handleStripeDisputeWebhook } from "./stripe-dispute.handler.js";

const CLAIMS_TABLE = "shop_processed_payment_event";

type Paid = { db: Database; paymentIntentId: string; eventId: string };

/** One Stripe money webhook handler, and how to see the effect it stores. */
type HandlerCase = {
  name: string;
  /** The notification the handler queues inside its transaction, after claiming the event. */
  queuesWith: "queueRefundIssued" | "queueCheckoutOpsAlert";
  deliver(paid: Paid, notifications: ShopNotificationPublisher): Promise<StripeMoneyWebhookOutcome>;
  /** How many rows of the effect are stored for this delivery. */
  storedEffects(paid: Paid): Promise<number>;
};

const CASES: HandlerCase[] = [
  {
    name: "refund webhook",
    queuesWith: "queueRefundIssued",
    deliver: ({ db, paymentIntentId, eventId }, notifications) =>
      completeRefundFromWebhook(
        db,
        {
          eventId,
          stripeRefundId: `re_${eventId}`,
          paymentIntentId,
          amountPence: 100,
          status: "succeeded",
          source: "refund.created",
        },
        "off",
        { notifications },
      ),
    storedEffects: async ({ db, eventId }) =>
      (
        await db
          .select()
          .from(shopRefund)
          .where(eq(shopRefund.stripeRefundId, `re_${eventId}`))
      ).length,
  },
  {
    name: "dispute webhook",
    queuesWith: "queueCheckoutOpsAlert",
    deliver: ({ db, paymentIntentId, eventId }, notifications) =>
      handleStripeDisputeWebhook(
        db,
        {
          eventId,
          stripeDisputeId: `dp_${eventId}`,
          paymentIntentId,
          amountPence: 100,
          status: "opened",
        },
        { domainEventMode: "off", notifications, opsAlertEmail: "ops@example.test" },
      ),
    storedEffects: async ({ db, eventId }) =>
      (
        await db
          .select()
          .from(shopDispute)
          .where(eq(shopDispute.stripeDisputeId, `dp_${eventId}`))
      ).length,
  },
];

/** A notification queue that holds the first delivery open until released, then fails it or not. */
function heldOpen(method: HandlerCase["queuesWith"], afterRelease: "fail" | "pass") {
  let release!: () => void;
  let reached!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  const firstReachedQueue = new Promise<void>((resolve) => {
    reached = resolve;
  });
  let calls = 0;
  const queue = vi.fn(async () => {
    calls += 1;
    if (calls > 1) return;
    reached();
    await released;
    if (afterRelease === "fail") throw new Error("notification queue unavailable");
  });
  return {
    notifications: { [method]: queue } as unknown as ShopNotificationPublisher,
    release,
    firstReachedQueue,
  };
}

describe.skipIf(!hasShopIntegrationDb)(
  "the same Stripe money webhook delivered twice at once (integration)",
  () => {
    let ownerPool!: pg.Pool;
    let shopPool!: pg.Pool;

    beforeAll(async () => {
      ({ ownerPool, shopPool } = await setupShopIntegrationPools());
    });

    afterAll(async () => {
      await Promise.allSettled([ownerPool.end(), shopPool.end()]);
    });

    /** An order that Stripe has a payment for, and an event id no other test shares. */
    async function paidOrder(label: string): Promise<Paid> {
      const { db, checkout } = await setupShopCheckout(shopPool, label);
      const created = await checkout("buyer");
      const paymentIntentId = `pi_${label}_${created.orderId}`;
      await db
        .update(shopOrder)
        .set({ stripePaymentIntentId: paymentIntentId })
        .where(eq(shopOrder.id, created.orderId));
      return { db, paymentIntentId, eventId: `evt_${label}_${created.orderId}` };
    }

    const claims = ({ db, eventId }: Paid) =>
      db
        .select()
        .from(shopProcessedPaymentEvent)
        .where(eq(shopProcessedPaymentEvent.eventId, eventId));

    describe.each(CASES)("$name", (handler) => {
      it("makes the second delivery wait, and stores the effect itself when the first fails", async () => {
        const paid = await paidOrder(`${handler.queuesWith}-fails`);
        const held = heldOpen(handler.queuesWith, "fail");

        const first = handler.deliver(paid, held.notifications).then(
          () => null,
          (error: unknown) => error,
        );
        await held.firstReachedQueue;
        const second = handler.deliver(paid, held.notifications);

        // The first has claimed the event but not committed: the second must be waiting on that
        // claim, and must not answer "duplicate" for work that is not stored.
        expect(await claimIsBlockedOnLock(ownerPool, CLAIMS_TABLE)).toBe(true);
        expect(await handler.storedEffects(paid)).toBe(0);
        held.release();
        expect(await first).toEqual(new Error("notification queue unavailable"));

        expect(await second).toBe("processed");
        expect(await handler.storedEffects(paid)).toBe(1);
        expect(await claims(paid)).toHaveLength(1);
      });

      it("answers the second delivery as a duplicate only once the first has committed", async () => {
        const paid = await paidOrder(`${handler.queuesWith}-commits`);
        const held = heldOpen(handler.queuesWith, "pass");

        const first = handler.deliver(paid, held.notifications);
        await held.firstReachedQueue;
        const second = handler.deliver(paid, held.notifications);
        expect(await claimIsBlockedOnLock(ownerPool, CLAIMS_TABLE)).toBe(true);
        held.release();

        expect(await first).toBe("processed");
        expect(await second).toBe("duplicate");
        expect(await handler.storedEffects(paid)).toBe(1);
        expect(await claims(paid)).toHaveLength(1);
      });
    });
  },
);
