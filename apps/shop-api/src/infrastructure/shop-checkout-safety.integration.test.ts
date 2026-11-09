import { domainEvent, shopEdition, shopOrder, shopProcessedPaymentEvent } from "@auction/db/schema";
import { DrizzleUnappliedMoneyReader } from "@auction/persistence/repositories";
import { and, eq, sql } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {
  CheckoutOrderInput,
  PaymentCheckoutGateway,
} from "../application/ports/commerce.ports.js";
import {
  grantLaxSaleAuthority,
  importTestArtwork,
  integrationSuffix,
  requireDefined,
} from "../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createDrizzleCommerceRepository } from "./drizzle-commerce.repository.js";
import {
  completeShopCheckoutSession,
  expireShopCheckoutSession,
} from "./drizzle-payment-event.processor.js";
import { extendCheckoutHold } from "./shop-checkout-hold.js";
import {
  SHOP_CHECKOUT_REAPER_EVENT_SOURCE,
  reaperEventIdForOrder,
} from "./shop-checkout-reaper.js";

const gateway: PaymentCheckoutGateway = {
  async createHostedCheckout(input) {
    const sessionId = `cs_test_${input.orderId}`;
    return {
      sessionId,
      paymentIntentId: null,
      checkoutUrl: `https://pay.example.test/${sessionId}`,
    };
  },
  async resolveHostedCheckout(input) {
    return { checkoutUrl: `https://pay.example.test/${input.sessionId}` };
  },
  async expireHostedCheckout() {
    return { kind: "expired" };
  },
};

describe.skipIf(!hasShopIntegrationDb)(
  "checkout safety: holds, the reaper and late payments",
  () => {
    let ownerPool!: pg.Pool;
    let shopPool!: pg.Pool;

    beforeAll(async () => {
      ({ ownerPool, shopPool } = await setupShopIntegrationPools());
    });

    afterAll(async () => {
      await Promise.allSettled([ownerPool.end(), shopPool.end()]);
    });

    /** One print on sale, and buyers who can each put it in a basket and start checkout. */
    async function setup(label: string) {
      const db = createShopDb(shopPool);
      const imported = await importTestArtwork(db, label, { printPricePence: 8_000 });
      await grantLaxSaleAuthority(db, imported.artworkId, 1);
      const repo = createDrizzleCommerceRepository(db, gateway, {
        storefrontUrl: "http://localhost:3020",
        domainEventMode: "off",
      });
      const checkout = async (buyer: string) => {
        const subject = `subject-${integrationSuffix(`${label}-${buyer}`)}`;
        const basket = await repo.addOrUpdateLine({
          owner: { kind: "subject", identitySubjectId: subject },
          artworkSlug: imported.slug,
          quantity: 1,
        });
        const request: CheckoutOrderInput = {
          subject,
          basketId: basket.basketId,
          fulfilment: "uk_insured_delivery",
          idempotencyKey: `checkout:${basket.basketId}:order`,
          successUrl: "http://localhost:3020/checkout/confirmation?orderId={ORDER_ID}",
          cancelUrl: "http://localhost:3020/checkout/cancel?orderId={ORDER_ID}",
          deliveryAddress: {
            recipientName: "Ada Lovelace",
            line1: "1 High Street",
            city: "London",
            postcode: "SW1A 1AA",
            country: "GB",
          },
          deliveryPhone: "07700 900123",
        };
        return repo.createCheckoutOrder(request);
      };
      const order = async (orderId: string) =>
        requireDefined(
          (await db.select().from(shopOrder).where(eq(shopOrder.id, orderId)).limit(1))[0],
          "order",
        );
      const holder = async () =>
        requireDefined(
          (
            await db.select().from(shopEdition).where(eq(shopEdition.artworkId, imported.artworkId))
          )[0],
          "edition",
        );
      const pastHold = (orderId: string) =>
        db
          .update(shopOrder)
          .set({ checkoutExpiresAt: new Date(Date.now() - 60_000) })
          .where(eq(shopOrder.id, orderId));
      return { db, repo, checkout, order, holder, pastHold };
    }

    it("records a payment that arrives after the order closed, once, leaving the edition with the next buyer", async () => {
      const { db, checkout, order, holder, pastHold } = await setup("late-payment");
      const first = await checkout("first");
      await pastHold(first.orderId);
      expect(
        await expireShopCheckoutSession(db, {
          eventId: reaperEventIdForOrder(first.orderId),
          orderId: first.orderId,
          source: SHOP_CHECKOUT_REAPER_EVENT_SOURCE,
        }),
      ).toBe("expired");
      // Another buyer takes the print the first one let go.
      const second = await checkout("second");
      expect((await holder()).reservedByOrderId).toBe(second.orderId);

      const closed = await order(first.orderId);
      const unappliedMoney = new DrizzleUnappliedMoneyReader(db);
      const paid = {
        eventId: `evt_late_${first.orderId}`,
        orderId: first.orderId,
        sessionId: `cs_test_${first.orderId}`,
        amountTotalPence: closed.totalPence,
        paidAt: new Date(),
        paymentIntentId: "pi_late_1",
      };
      const options = { domainEventMode: "enforce" as const, unappliedMoney };
      const tasks = () =>
        db
          .select()
          .from(domainEvent)
          .where(
            and(
              eq(domainEvent.eventType, "payment.unapplied_money_received"),
              sql`${domainEvent.payload}->>'shopOrderId' = ${first.orderId}`,
            ),
          );

      expect(await completeShopCheckoutSession(db, paid, options)).toBe("terminal_acknowledged");
      const [task] = await tasks();
      expect(await tasks()).toHaveLength(1);
      expect(task?.payload).toMatchObject({
        reason: "shop_order_paid_after_close",
        shopOrderId: first.orderId,
        shopOrderReference: closed.reference,
        shopCheckoutSessionId: paid.sessionId,
        stripePaymentIntentId: "pi_late_1",
        amountCents: closed.totalPence,
      });
      // Nothing was refunded, reinstated or released: the print is still the second buyer's.
      expect((await order(first.orderId)).status).toBe("expired");
      expect((await holder()).reservedByOrderId).toBe(second.orderId);

      // The same event again is a duplicate, and a second event for the same PaymentIntent opens no new task.
      expect(await completeShopCheckoutSession(db, paid, options)).toBe("duplicate");
      expect(
        await completeShopCheckoutSession(
          db,
          { ...paid, eventId: `${paid.eventId}_again` },
          options,
        ),
      ).toBe("terminal_acknowledged");
      expect(await tasks()).toHaveLength(1);
    });

    it("spares an order whose hold was stretched after the sweep chose it, and ends it on a later sweep", async () => {
      const { db, checkout, order, pastHold } = await setup("reaper-spares");
      const created = await checkout("buyer");
      const eventId = reaperEventIdForOrder(created.orderId);
      const sweepAt = new Date();
      // The hold runs on past the sweep's time: the order is not the reaper's yet.
      await db
        .update(shopOrder)
        .set({ checkoutExpiresAt: new Date(sweepAt.getTime() + 10 * 60_000) })
        .where(eq(shopOrder.id, created.orderId));
      const spared = await expireShopCheckoutSession(db, {
        eventId,
        orderId: created.orderId,
        source: SHOP_CHECKOUT_REAPER_EVENT_SOURCE,
        holdMustHaveEndedBy: sweepAt,
      });
      expect(spared).toBe("unchanged");
      expect((await order(created.orderId)).status).toBe("pending_payment");
      // The event was not used up, so the next sweep can still end the order.
      const used = await db
        .select()
        .from(shopProcessedPaymentEvent)
        .where(eq(shopProcessedPaymentEvent.eventId, eventId));
      expect(used).toHaveLength(0);

      await pastHold(created.orderId);
      const later = await expireShopCheckoutSession(db, {
        eventId,
        orderId: created.orderId,
        source: SHOP_CHECKOUT_REAPER_EVENT_SOURCE,
        holdMustHaveEndedBy: new Date(),
      });
      expect(later).toBe("expired");
      expect((await order(created.orderId)).status).toBe("expired");
    });

    it("will not stretch a hold that has already ended", async () => {
      const { db, checkout, order, holder, pastHold } = await setup("no-revive");
      const created = await checkout("buyer");
      // A session-less order whose hold just ended: the reaper may be about to expire it.
      await db
        .update(shopOrder)
        .set({ stripeCheckoutSessionId: null })
        .where(eq(shopOrder.id, created.orderId));
      await pastHold(created.orderId);
      const before = await order(created.orderId);
      const reserved = await holder();

      await expect(
        extendCheckoutHold(db, created.orderId, new Date(Date.now() + 31 * 60_000), new Date()),
      ).rejects.toMatchObject({ statusCode: 409 });

      expect((await order(created.orderId)).checkoutExpiresAt).toEqual(before.checkoutExpiresAt);
      expect((await holder()).reservedUntil).toEqual(reserved.reservedUntil);
    });
  },
);
