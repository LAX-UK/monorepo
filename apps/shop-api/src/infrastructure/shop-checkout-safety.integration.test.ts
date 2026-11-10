import {
  domainEvent,
  shopDeliveryQuote,
  shopEdition,
  shopOrder,
  shopProcessedPaymentEvent,
} from "@auction/db/schema";
import { DrizzleUnappliedMoneyReader } from "@auction/persistence/repositories";
import { and, eq, sql } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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
  reapStaleShopCheckouts,
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
  retrievePaidCheckout: async () => null,
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
      // The print on sale: the edition an order holds if one does, else the first. The run may
      // have more than one edition, and the rows do not come back in a fixed order unless asked.
      const holder = async () =>
        requireDefined(
          (
            await db
              .select()
              .from(shopEdition)
              .where(eq(shopEdition.artworkId, imported.artworkId))
              .orderBy(sql`${shopEdition.reservedByOrderId} is null`, shopEdition.editionNumber)
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

    it("defers an order whose payment is still being confirmed, moving the hold and the reservation together, up to a ceiling", async () => {
      const { db, checkout, order, holder } = await setup("async-defer");
      const created = await checkout("buyer");
      const pending: PaymentCheckoutGateway = {
        ...gateway,
        async expireHostedCheckout() {
          return { kind: "async_pending" };
        },
      };
      const sweep = () =>
        expireShopCheckoutSession(
          db,
          {
            eventId: `${reaperEventIdForOrder(created.orderId)}:${Math.random()}`,
            orderId: created.orderId,
            source: SHOP_CHECKOUT_REAPER_EVENT_SOURCE,
          },
          { paymentGateway: pending },
        );

      expect(await sweep()).toBe("deferred_async");
      const first = await order(created.orderId);
      const held = await holder();
      expect(first.checkoutExpiresAt?.getTime()).toBeGreaterThan(Date.now());
      // The reservation moved with the hold, not left to lapse under a payment still coming.
      expect(held.reservedUntil?.getTime()).toBeGreaterThanOrEqual(
        (first.checkoutExpiresAt as Date).getTime(),
      );

      // An order that began more than the ceiling ago gets no further deferral and is ended.
      await db
        .update(shopOrder)
        .set({ createdAt: new Date(Date.now() - 22 * 24 * 60 * 60_000) })
        .where(eq(shopOrder.id, created.orderId));
      expect(await sweep()).toBe("expired");
      expect((await order(created.orderId)).status).toBe("expired");
    });

    describe("a session Stripe shows paid whose payment event never reached us", () => {
      async function stuckPaid(
        label: string,
        readable: Awaited<ReturnType<typeof paidSession>> | null,
      ) {
        const harness = await setup(label);
        const created = await harness.checkout("buyer");
        const before = await harness.order(created.orderId);
        const gate: PaymentCheckoutGateway = {
          ...gateway,
          async expireHostedCheckout() {
            return { kind: "already_complete" };
          },
          async retrievePaidCheckout() {
            return readable
              ? { ...readable, amountTotalPence: before.totalPence + readable.amountTotalPence }
              : null;
          },
        };
        const queueCheckoutOpsAlert = vi.fn(async () => undefined);
        const options = {
          paymentGateway: gate,
          unappliedMoney: new DrizzleUnappliedMoneyReader(harness.db),
          domainEventMode: "enforce" as const,
          opsAlertEmail: "ops@example.test",
          notifications: { queueCheckoutOpsAlert } as never,
        };
        const sweep = () =>
          expireShopCheckoutSession(
            harness.db,
            {
              eventId: `${reaperEventIdForOrder(created.orderId)}:${Math.random()}`,
              orderId: created.orderId,
              source: SHOP_CHECKOUT_REAPER_EVENT_SOURCE,
            },
            options,
          );
        return { ...harness, created, before, options, sweep, queueCheckoutOpsAlert };
      }
      const paidSession = async (extraPence: number) => ({
        amountTotalPence: extraPence,
        paymentIntentId: `pi_${Math.random()}`,
        livemode: false,
        paidAt: new Date(),
      });

      it("applies it when it is paid and matches the order, instead of deferring for ever", async () => {
        const { sweep, order, created } = await stuckPaid("reconcile-ok", await paidSession(0));
        expect(await sweep()).toBe("reconciled");
        expect((await order(created.orderId)).status).toBe("paid");
      });

      it("records a finance task and closes the order when the amount is not the order's", async () => {
        const { db, sweep, order, holder, created } = await stuckPaid(
          "reconcile-mismatch",
          await paidSession(-1),
        );
        expect(await sweep()).toBe("reconciled");
        expect((await order(created.orderId)).status).toBe("payment_failed");
        expect((await holder()).reservedByOrderId).toBeNull();
        const tasks = await db
          .select()
          .from(domainEvent)
          .where(
            and(
              eq(domainEvent.eventType, "payment.unapplied_money_received"),
              sql`${domainEvent.payload}->>'shopOrderId' = ${created.orderId}`,
            ),
          );
        expect(tasks).toHaveLength(1);
      });

      it("opens one task, not two, when the webhook for the same payment arrives after the sweep recorded it", async () => {
        const { db, sweep, created, before, options } = await stuckPaid(
          "reconcile-then-webhook",
          await paidSession(-1),
        );
        expect(await sweep()).toBe("reconciled");
        const tasks = () =>
          db
            .select()
            .from(domainEvent)
            .where(
              and(
                eq(domainEvent.eventType, "payment.unapplied_money_received"),
                sql`${domainEvent.payload}->>'shopOrderId' = ${created.orderId}`,
              ),
            );
        const [first] = await tasks();
        const intent = (first?.payload as { stripePaymentIntentId: string }).stripePaymentIntentId;
        const webhook = {
          eventId: `evt_late_${created.orderId}`,
          orderId: created.orderId,
          sessionId: `cs_test_${created.orderId}`,
          amountTotalPence: before.totalPence - 1,
          paidAt: new Date(),
          paymentIntentId: intent,
        };
        // The order is closed by now, so the late event is money for a closed order: a second
        // reason, but the same payment.
        expect(await completeShopCheckoutSession(db, webhook, options)).toBe(
          "terminal_acknowledged",
        );
        expect(
          await completeShopCheckoutSession(
            db,
            { ...webhook, eventId: `${webhook.eventId}_b`, paymentIntentId: null },
            options,
          ),
        ).toBe("terminal_acknowledged");
        expect(await tasks()).toHaveLength(1);
      });

      it("defers an order it cannot read, moving hold and reservation together, and tells ops on the third time", async () => {
        const { sweep, order, holder, created, queueCheckoutOpsAlert } = await stuckPaid(
          "reconcile-unreadable",
          null,
        );
        for (let attempt = 1; attempt <= 3; attempt++) {
          expect(await sweep()).toBe("deferred_async");
          expect(queueCheckoutOpsAlert).toHaveBeenCalledTimes(attempt === 3 ? 1 : 0);
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        const left = await order(created.orderId);
        expect(left.status).toBe("pending_payment");
        expect((await holder()).reservedUntil?.getTime()).toBeGreaterThanOrEqual(
          (left.checkoutExpiresAt as Date).getTime(),
        );
      });
    });

    it("measures the ceiling from the quote being accepted, so a quote accepted on day 20 is still deferred", async () => {
      const { db, checkout, order } = await setup("async-defer-quote");
      const created = await checkout("buyer");
      const day = 24 * 60 * 60_000;
      await db
        .update(shopOrder)
        .set({ createdAt: new Date(Date.now() - 25 * day) })
        .where(eq(shopOrder.id, created.orderId));
      await db.insert(shopDeliveryQuote).values({
        orderId: created.orderId,
        status: "accepted",
        destinationCountry: "FR",
        holdUntil: new Date(Date.now() + day),
        quotedPricePence: 1_000,
        quotedCarrier: "DHL Express",
        decidedAt: new Date(Date.now() - day),
      });
      const pending: PaymentCheckoutGateway = {
        ...gateway,
        async expireHostedCheckout() {
          return { kind: "async_pending" };
        },
      };
      const outcome = await expireShopCheckoutSession(
        db,
        {
          eventId: `quote-day-20:${created.orderId}`,
          orderId: created.orderId,
          source: SHOP_CHECKOUT_REAPER_EVENT_SOURCE,
        },
        { paymentGateway: pending },
      );
      expect(outcome).toBe("deferred_async");
      const left = await order(created.orderId);
      expect(left.status).toBe("pending_payment");
      expect(left.reaperDeferrals).toBe(1);
    });

    it("closes an order past the ceiling that keeps failing, with a task, and still ends the others", async () => {
      const stuck = await setup("ceiling-stuck");
      const healthy = await setup("ceiling-healthy");
      const stuckOrder = await stuck.checkout("buyer");
      const healthyOrder = await healthy.checkout("buyer");
      const day = 24 * 60 * 60_000;
      await stuck.db
        .update(shopOrder)
        .set({
          createdAt: new Date(Date.now() - 22 * day),
          checkoutExpiresAt: new Date("2000-01-01T00:00:00Z"),
        })
        .where(eq(shopOrder.id, stuckOrder.orderId));
      await healthy.db
        .update(shopOrder)
        .set({ checkoutExpiresAt: new Date("2000-01-02T00:00:00Z") })
        .where(eq(shopOrder.id, healthyOrder.orderId));
      const stuckSession = (await stuck.order(stuckOrder.orderId)).stripeCheckoutSessionId;
      // Stripe cannot be read for the stuck order, however often it is asked.
      const stripe: PaymentCheckoutGateway = {
        ...gateway,
        async expireHostedCheckout(input) {
          if (input.sessionId === stuckSession) throw new Error("stripe unavailable");
          return { kind: "expired" };
        },
        async retrievePaidCheckout() {
          throw new Error("stripe unavailable");
        },
      };
      await reapStaleShopCheckouts(stuck.db, new Date(), {
        paymentGateway: stripe,
        unappliedMoney: new DrizzleUnappliedMoneyReader(stuck.db),
        domainEventMode: "enforce",
      });

      expect((await healthy.order(healthyOrder.orderId)).status).toBe("expired");
      expect((await stuck.order(stuckOrder.orderId)).status).toBe("payment_failed");
      const tasks = await stuck.db
        .select()
        .from(domainEvent)
        .where(
          and(
            eq(domainEvent.eventType, "payment.unapplied_money_received"),
            sql`${domainEvent.payload}->>'shopOrderId' = ${stuckOrder.orderId}`,
          ),
        );
      expect(tasks).toHaveLength(1);
      expect(tasks[0]?.payload).toMatchObject({ reason: "shop_order_paid_not_confirmed" });
    });

    it("takes an order out of the sweep, with one ops alert, when settling it past the ceiling fails", async () => {
      const { db, checkout, order } = await setup("ceiling-settle-fails");
      const created = await checkout("buyer");
      await db
        .update(shopOrder)
        .set({
          createdAt: new Date(Date.now() - 22 * 24 * 60 * 60_000),
          checkoutExpiresAt: new Date("2000-01-01T00:00:00Z"),
        })
        .where(eq(shopOrder.id, created.orderId));
      const stripe: PaymentCheckoutGateway = {
        ...gateway,
        async expireHostedCheckout() {
          throw new Error("stripe unavailable");
        },
        async retrievePaidCheckout() {
          throw new Error("stripe unavailable");
        },
      };
      const queueCheckoutOpsAlert = vi.fn(async () => undefined);
      // No finance store is wired, so closing the order with a task fails: the settle throws.
      const options = {
        paymentGateway: stripe,
        opsAlertEmail: "ops@example.test",
        notifications: { queueCheckoutOpsAlert } as never,
      };
      await reapStaleShopCheckouts(db, new Date(), options);

      const left = await order(created.orderId);
      expect(left.status).toBe("pending_payment");
      expect(left.checkoutExpiresAt).toBeNull();
      expect(queueCheckoutOpsAlert).toHaveBeenCalledTimes(1);
      // It is no longer in the sweep, so a second sweep does not touch it or alert again.
      await reapStaleShopCheckouts(db, new Date(), options);
      expect(queueCheckoutOpsAlert).toHaveBeenCalledTimes(1);
    });

    describe("the same payment event delivered twice at once", () => {
      /** A receipt queue that holds the first delivery open until released, then fails it or not. */
      function receiptsHeldOpen(afterRelease: "fail" | "pass") {
        let release!: () => void;
        let reached!: () => void;
        const released = new Promise<void>((resolve) => {
          release = resolve;
        });
        const firstReachedReceipt = new Promise<void>((resolve) => {
          reached = resolve;
        });
        let calls = 0;
        const queueOrderReceipt = vi.fn(async () => {
          calls += 1;
          if (calls > 1) return;
          reached();
          await released;
          if (afterRelease === "fail") throw new Error("receipt queue unavailable");
        });
        return {
          options: {
            notifications: { queueOrderReceipt } as never,
            storefrontUrl: "http://localhost:3020",
          },
          release,
          firstReachedReceipt,
        };
      }

      async function paidEvent(label: string) {
        const harness = await setup(label);
        const created = await harness.checkout("buyer");
        const placed = await harness.order(created.orderId);
        const paid = {
          eventId: `evt_${label}_${created.orderId}`,
          orderId: created.orderId,
          sessionId: `cs_test_${created.orderId}`,
          amountTotalPence: placed.totalPence,
          paidAt: new Date(),
          paymentIntentId: `pi_${label}`,
        };
        const claims = () =>
          harness.db
            .select()
            .from(shopProcessedPaymentEvent)
            .where(eq(shopProcessedPaymentEvent.eventId, paid.eventId));
        return { ...harness, created, paid, claims };
      }

      /** Waits, for a bounded time, until a statement on the claims table is blocked on a lock. */
      async function claimIsBlockedOnLock(): Promise<boolean> {
        for (let attempt = 0; attempt < 50; attempt += 1) {
          const { rowCount } = await ownerPool.query(
            `select 1 from pg_stat_activity
             where datname = current_database()
               and wait_event_type = 'Lock'
               and query ilike '%shop_processed_payment_event%'`,
          );
          if (rowCount) return true;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        return false;
      }

      it("makes the second delivery wait for the first, and records the payment when the first fails", async () => {
        const { db, order, created, paid, claims } = await paidEvent("webhook-first-fails");
        const receipts = receiptsHeldOpen("fail");
        const { options } = receipts;

        const first = completeShopCheckoutSession(db, paid, options);
        const firstFailure = expect(first).rejects.toThrow("receipt queue unavailable");
        await receipts.firstReachedReceipt;
        const second = completeShopCheckoutSession(db, paid, options);

        // The first has claimed the event but not committed: the second must not answer yet, and
        // above all must not answer "duplicate" for work that is not recorded.
        expect(await claimIsBlockedOnLock()).toBe(true);
        receipts.release();
        await firstFailure;

        expect(await second).toBe("processed");
        expect((await order(created.orderId)).status).toBe("paid");
        expect(await claims()).toHaveLength(1);
      });

      it("answers the second delivery as a duplicate only once the first is committed", async () => {
        const { db, order, created, paid, claims } = await paidEvent("webhook-first-succeeds");
        const receipts = receiptsHeldOpen("pass");
        const { options } = receipts;

        const first = completeShopCheckoutSession(db, paid, options);
        await receipts.firstReachedReceipt;
        const second = completeShopCheckoutSession(db, paid, options);
        expect(await claimIsBlockedOnLock()).toBe(true);
        receipts.release();

        expect(await first).toBe("processed");
        expect(await second).toBe("duplicate");
        expect((await order(created.orderId)).status).toBe("paid");
        expect(await claims()).toHaveLength(1);
      });
    });

    it("leaves a session alone when payment was opened again after the sweep chose the order", async () => {
      const { db, checkout, order } = await setup("reaper-new-session");
      const created = await checkout("buyer");
      const sweepAt = new Date();
      // Payment was opened again: a new session, and a hold that runs past the sweep.
      await db
        .update(shopOrder)
        .set({
          stripeCheckoutSessionId: "cs_test_reopened",
          checkoutExpiresAt: new Date(sweepAt.getTime() + 30 * 60_000),
        })
        .where(eq(shopOrder.id, created.orderId));
      const expireHostedCheckout = vi.fn(async () => ({ kind: "expired" as const }));

      const outcome = await expireShopCheckoutSession(
        db,
        {
          eventId: reaperEventIdForOrder(created.orderId),
          orderId: created.orderId,
          source: SHOP_CHECKOUT_REAPER_EVENT_SOURCE,
          holdMustHaveEndedBy: sweepAt,
        },
        { paymentGateway: { ...gateway, expireHostedCheckout } },
      );

      expect(outcome).toBe("unchanged");
      expect(expireHostedCheckout).not.toHaveBeenCalled();
      expect((await order(created.orderId)).status).toBe("pending_payment");
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

    describe("a payment that cannot be applied leaves one finance task and changes nothing", () => {
      async function trackedPayment(label: string) {
        const harness = await setup(label);
        const { db, checkout, order, holder } = harness;
        const first = await checkout("buyer");
        const before = await order(first.orderId);
        const heldBefore = await holder();
        const unappliedMoney = new DrizzleUnappliedMoneyReader(db);
        const options = { domainEventMode: "enforce" as const, unappliedMoney };
        const paid = (overrides: Record<string, unknown> = {}) => ({
          eventId: `evt_${label}_${first.orderId}`,
          orderId: first.orderId,
          sessionId: `cs_test_${first.orderId}`,
          amountTotalPence: before.totalPence,
          paidAt: new Date(),
          paymentIntentId: `pi_${label}_${first.orderId}`,
          ...overrides,
        });
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
        return { ...harness, first, before, heldBefore, options, paid, tasks };
      }

      it("for the wrong amount on the order's own session: tracks what was paid and closes the order, freeing the print", async () => {
        const { db, order, holder, first, before, heldBefore, options, paid, tasks } =
          await trackedPayment("amount");
        expect(heldBefore.reservedByOrderId).toBe(first.orderId);
        const event = paid({ amountTotalPence: before.totalPence - 1 });
        expect(await completeShopCheckoutSession(db, event, options)).toBe("unapplied_recorded");
        expect(await tasks()).toHaveLength(1);
        expect((await tasks())[0]?.payload).toMatchObject({
          reason: "shop_order_amount_mismatch",
          amountCents: before.totalPence - 1,
        });
        // The session is spent, so nothing could ever pay or expire the order: it is closed.
        expect((await order(first.orderId)).status).toBe("payment_failed");
        expect((await holder()).reservedByOrderId).toBeNull();
        expect(await completeShopCheckoutSession(db, event, options)).toBe("duplicate");
        expect(await tasks()).toHaveLength(1);
      });

      it("for another payment session: tracks it, leaves the order pending and the print reserved", async () => {
        const { db, order, holder, first, heldBefore, options, paid, tasks } =
          await trackedPayment("session");
        const event = paid({ sessionId: "cs_test_not_this_order" });
        expect(await completeShopCheckoutSession(db, event, options)).toBe("unapplied_recorded");
        expect((await tasks())[0]?.payload).toMatchObject({
          reason: "shop_order_session_mismatch",
          shopCheckoutSessionId: "cs_test_not_this_order",
        });
        expect((await order(first.orderId)).status).toBe("pending_payment");
        expect((await holder()).reservedByOrderId).toBe(heldBefore.reservedByOrderId);
        expect(await completeShopCheckoutSession(db, event, options)).toBe("duplicate");
        expect(await tasks()).toHaveLength(1);
      });

      it("a reaper sweep with an order it cannot end still ends the others, and puts that order back", async () => {
        const stuck = await setup("reaper-stuck");
        const healthy = await setup("reaper-healthy");
        const stuckOrder = await stuck.checkout("buyer");
        const healthyOrder = await healthy.checkout("buyer");
        const stuckSession = (await stuck.order(stuckOrder.orderId)).stripeCheckoutSessionId;
        // Both are long past their hold, the stuck one first in the oldest-first batch.
        await stuck.db
          .update(shopOrder)
          .set({ checkoutExpiresAt: new Date("2000-01-01T00:00:00Z") })
          .where(eq(shopOrder.id, stuckOrder.orderId));
        await healthy.db
          .update(shopOrder)
          .set({ checkoutExpiresAt: new Date("2000-01-02T00:00:00Z") })
          .where(eq(shopOrder.id, healthyOrder.orderId));
        // Stripe says the stuck order's session is already complete, which blocks its expiry.
        const stripe: PaymentCheckoutGateway = {
          ...gateway,
          async expireHostedCheckout(input) {
            return input.sessionId === stuckSession
              ? { kind: "already_complete" }
              : { kind: "expired" };
          },
        };
        const now = new Date();
        await reapStaleShopCheckouts(stuck.db, now, { paymentGateway: stripe });

        expect((await healthy.order(healthyOrder.orderId)).status).toBe("expired");
        const left = await stuck.order(stuckOrder.orderId);
        expect(left.status).toBe("pending_payment");
        expect(left.checkoutExpiresAt?.getTime()).toBeGreaterThan(now.getTime());
      });

      it("for a second payment on an order already paid: tracks it and keeps the sale", async () => {
        const { db, order, holder, first, options, paid, tasks } = await trackedPayment("twice");
        expect(await completeShopCheckoutSession(db, paid(), options)).toBe("processed");
        expect((await order(first.orderId)).status).toBe("paid");
        const soldTo = (await holder()).ownerPartyId;

        const again = paid({
          eventId: `evt_twice_second_${first.orderId}`,
          sessionId: "cs_test_second_payment",
          paymentIntentId: `pi_second_${first.orderId}`,
        });
        expect(await completeShopCheckoutSession(db, again, options)).toBe("unapplied_recorded");
        expect((await tasks())[0]?.payload).toMatchObject({ reason: "shop_order_paid_twice" });
        expect((await order(first.orderId)).status).toBe("paid");
        expect((await holder()).ownerPartyId).toBe(soldTo);
        expect(await completeShopCheckoutSession(db, again, options)).toBe("duplicate");
        // A different event for the same payment finds the task and opens nothing new.
        expect(
          await completeShopCheckoutSession(
            db,
            { ...again, eventId: `${again.eventId}_b` },
            options,
          ),
        ).toBe("unapplied_recorded");
        expect(await tasks()).toHaveLength(1);
      });

      it("for the same session again on a paid order: nothing new, no task", async () => {
        const { db, options, paid, tasks } = await trackedPayment("same-session");
        await completeShopCheckoutSession(db, paid(), options);
        expect(
          await completeShopCheckoutSession(
            db,
            paid({ eventId: "evt_same_session_second_event" }),
            options,
          ),
        ).toBe("processed");
        expect(await tasks()).toHaveLength(0);
      });

      it("for a closed order, tracks what was actually paid even when it is not the total", async () => {
        const { db, order, first, before, options, paid, tasks, pastHold } =
          await trackedPayment("closed");
        await pastHold(first.orderId);
        await expireShopCheckoutSession(db, {
          eventId: reaperEventIdForOrder(first.orderId),
          orderId: first.orderId,
          source: SHOP_CHECKOUT_REAPER_EVENT_SOURCE,
        });
        const event = paid({ amountTotalPence: before.totalPence - 500 });
        expect(await completeShopCheckoutSession(db, event, options)).toBe("terminal_acknowledged");
        expect((await tasks())[0]?.payload).toMatchObject({
          reason: "shop_order_paid_after_close",
          amountCents: before.totalPence - 500,
        });
        expect((await order(first.orderId)).status).toBe("expired");
        expect(await completeShopCheckoutSession(db, event, options)).toBe("duplicate");
        expect(await tasks()).toHaveLength(1);
      });
    });
  },
);
