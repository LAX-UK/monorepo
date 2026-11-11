import type { RegisterLink } from "@auction/artwork-register-contracts";
import { domainEvent, shopFulfilment, shopOrder } from "@auction/db/schema";
import { DrizzleUnappliedMoneyReader } from "@auction/persistence/repositories";
import { and, eq, sql } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDeliveryQuoteAcceptanceService } from "../application/delivery-quote-acceptance/delivery-quote-acceptance.service.js";
import type {
  CheckoutOrderInput,
  PaymentCheckoutGateway,
} from "../application/ports/commerce.ports.js";
import { createGuestCheckoutDeps } from "../create-guest-checkout-deps.js";
import {
  grantLaxSaleAuthority,
  importTestArtwork,
  integrationSuffix,
} from "../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createDrizzleCheckoutMoneyPause } from "./drizzle-checkout-money-pause.js";
import { createDrizzleCommerceRepository } from "./drizzle-commerce.repository.js";
import { completeShopCheckoutSession } from "./drizzle-payment-event.processor.js";
import { expirePausedShopCheckouts } from "./shop-checkout-money-pause-sweep.js";

function recordingGateway() {
  const created: string[] = [];
  const expired: string[] = [];
  const gateway: PaymentCheckoutGateway = {
    async createHostedCheckout(input) {
      const sessionId = `cs_test_${input.orderId}_${created.length + 1}`;
      created.push(sessionId);
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
    async expireHostedCheckout(input) {
      expired.push(input.sessionId);
      return { kind: "expired" };
    },
  };
  return { gateway, created, expired };
}

const PAUSED_MESSAGE = "This artwork is no longer available to buy online.";

describe.skipIf(!hasShopIntegrationDb)("checkout money pause, on every payment path", () => {
  let ownerPool!: pg.Pool;
  let shopPool!: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await Promise.allSettled([ownerPool.end(), shopPool.end()]);
  });

  async function setup(label: string, options: { zohoLinked?: boolean } = {}) {
    const db = createShopDb(shopPool);
    const suffix = integrationSuffix(label);
    const imported = await importTestArtwork(db, label, { printPricePence: 8_000 });
    await grantLaxSaleAuthority(db, imported.artworkId, 1);
    const zohoProductId = `zoho-pause-${suffix}`;
    if (options.zohoLinked !== false) {
      await ownerPool.query("update shop_artwork set zoho_product_id = $1 where id = $2", [
        zohoProductId,
        imported.artworkId,
      ]);
    }
    const paused = new Set<string>();
    const pause = {
      isPaused: async (link: RegisterLink) =>
        "zohoProductId" in link && paused.has(link.zohoProductId),
    };
    const recording = recordingGateway();
    const guard = createDrizzleCheckoutMoneyPause(db, pause);
    const repo = createDrizzleCommerceRepository(db, recording.gateway, {
      storefrontUrl: "http://localhost:3020",
      domainEventMode: "off",
      moneyPause: guard,
    });
    const subject = `subject-${suffix}`;
    const basket = await repo.addOrUpdateLine({
      owner: { kind: "subject", identitySubjectId: subject },
      artworkSlug: imported.slug,
      quantity: 1,
    });
    const request = (): CheckoutOrderInput => ({
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
    });
    const pauseNow = () => paused.add(zohoProductId);
    const resumeNow = () => paused.delete(zohoProductId);
    const resume = (orderId: string) =>
      repo.resumeCheckoutOrder({
        subject,
        orderId,
        successUrl: "http://localhost:3020/checkout/confirmation?orderId={ORDER_ID}",
        cancelUrl: "http://localhost:3020/checkout/cancel?orderId={ORDER_ID}",
      });
    return { db, repo, recording, request, pauseNow, resumeNow, resume, subject, guard };
  }

  const refused = { message: PAUSED_MESSAGE, statusCode: 409 };

  it("refuses a new checkout for a paused artwork", async () => {
    const t = await setup("pause-new");
    t.pauseNow();
    await expect(t.repo.createCheckoutOrder(t.request())).rejects.toMatchObject(refused);
    expect(t.recording.created).toEqual([]);
  });

  it("refuses to resume an existing pending order, and opens no session", async () => {
    const t = await setup("pause-resume");
    const order = await t.repo.createCheckoutOrder(t.request());
    const sessions = t.recording.created.length;
    t.pauseNow();
    await expect(t.resume(order.orderId)).rejects.toMatchObject(refused);
    expect(t.recording.created).toHaveLength(sessions);
  });

  it("refuses to resume a pending order that has no session yet, and opens none", async () => {
    const t = await setup("pause-resume-bare");
    const order = await t.repo.createCheckoutOrder(t.request());
    await t.db
      .update(shopOrder)
      .set({ stripeCheckoutSessionId: null })
      .where(eq(shopOrder.id, order.orderId));
    const sessions = t.recording.created.length;
    t.pauseNow();
    await expect(t.resume(order.orderId)).rejects.toMatchObject(refused);
    expect(t.recording.created).toHaveLength(sessions);
  });

  it("refuses a retry of the same checkout (the replay path)", async () => {
    const t = await setup("pause-replay");
    await t.repo.createCheckoutOrder(t.request());
    const sessions = t.recording.created.length;
    t.pauseNow();
    await expect(t.repo.createCheckoutOrder(t.request())).rejects.toMatchObject(refused);
    expect(t.recording.created).toHaveLength(sessions);
  });

  it("refuses a guest resuming a pending order, which goes through the same writer", async () => {
    const t = await setup("pause-guest");
    const order = await t.repo.createCheckoutOrder(t.request());
    const guest = createGuestCheckoutDeps(t.db, {
      identity: {} as never,
      checkout: t.repo,
      acceptance: { acceptAndPay: async () => ({}) as never },
      orders: t.repo,
      notifications: {} as never,
      paymentGateway: t.recording.gateway,
      rateLimitCounter: {} as never,
      storefrontUrl: "http://localhost:3020",
      domainEventMode: "off",
      ipHashSecret: "test",
      invoiceIssuer: { supplier: {} as never, vatNumber: null },
    });
    t.pauseNow();
    await expect(
      guest.resumeCheckout({
        subject: t.subject,
        orderId: order.orderId,
        successUrl: "http://localhost:3020/checkout/confirmation?orderId={ORDER_ID}",
        cancelUrl: "http://localhost:3020/checkout/cancel?orderId={ORDER_ID}",
      }),
    ).rejects.toMatchObject(refused);
  });

  it("refuses accept-and-pay on a delivery quote, which resumes the order to pay", async () => {
    const t = await setup("pause-quote");
    const order = await t.repo.createCheckoutOrder(t.request());
    const acceptance = createDeliveryQuoteAcceptanceService({
      store: { accept: async () => undefined },
      checkout: t.repo,
      exportPaymentEnabled: true,
    });
    t.pauseNow();
    await expect(
      acceptance.acceptAndPay({
        subject: t.subject,
        orderId: order.orderId,
        successUrl: "http://localhost:3020/checkout/confirmation?orderId={ORDER_ID}",
        cancelUrl: "http://localhost:3020/checkout/cancel?orderId={ORDER_ID}",
      }),
    ).rejects.toMatchObject(refused);
  });

  it("lets the same order be resumed and retried again once the pause is lifted", async () => {
    const t = await setup("pause-lifted");
    const order = await t.repo.createCheckoutOrder(t.request());
    t.pauseNow();
    await expect(t.resume(order.orderId)).rejects.toMatchObject(refused);
    t.resumeNow();
    await expect(t.resume(order.orderId)).resolves.toMatchObject({ orderId: order.orderId });
    await expect(t.repo.createCheckoutOrder(t.request())).resolves.toMatchObject({
      orderId: order.orderId,
    });
  });

  it("does not govern an artwork with no Zoho Product", async () => {
    const t = await setup("pause-unlinked", { zohoLinked: false });
    t.pauseNow();
    const order = await t.repo.createCheckoutOrder(t.request());
    await expect(t.resume(order.orderId)).resolves.toMatchObject({ orderId: order.orderId });
  });

  describe("a payment page opened before the artwork was paused", () => {
    const orderRow = async (t: { db: ReturnType<typeof createShopDb> }, orderId: string) => {
      const [row] = await t.db.select().from(shopOrder).where(eq(shopOrder.id, orderId));
      if (!row) throw new Error("order missing");
      return row;
    };

    it("is expired when the item is raised: Stripe is asked to end it and the order expires", async () => {
      const t = await setup("pause-sweep");
      const order = await t.repo.createCheckoutOrder(t.request());
      const sessionId = (await orderRow(t, order.orderId)).stripeCheckoutSessionId;
      expect(sessionId).toBeTruthy();
      const options = { paymentGateway: t.recording.gateway, domainEventMode: "off" as const };

      // Not paused yet: the sweep leaves the order and its page alone.
      await expirePausedShopCheckouts(t.db, t.guard, options);
      expect(t.recording.expired).toEqual([]);
      expect((await orderRow(t, order.orderId)).status).toBe("pending_payment");

      t.pauseNow();
      await expirePausedShopCheckouts(t.db, t.guard, options);
      expect(t.recording.expired).toEqual([sessionId]);
      expect((await orderRow(t, order.orderId)).status).toBe("expired");

      // Repeating it changes nothing.
      await expirePausedShopCheckouts(t.db, t.guard, options);
      expect(t.recording.expired).toEqual([sessionId]);
    });

    const paymentFor = (orderId: string, sessionId: string, totalPence: number) => ({
      eventId: `evt_paused_${orderId}`,
      orderId,
      sessionId,
      amountTotalPence: totalPence,
      paidAt: new Date(),
      paymentIntentId: `pi_paused_${orderId}`,
    });

    it("if paid anyway, is not fulfilled: it goes to finance and the order is closed", async () => {
      const t = await setup("pause-backstop");
      const order = await t.repo.createCheckoutOrder(t.request());
      const row = await orderRow(t, order.orderId);
      const options = {
        domainEventMode: "enforce" as const,
        unappliedMoney: new DrizzleUnappliedMoneyReader(t.db),
        moneyPause: t.guard,
      };
      t.pauseNow();
      const paid = paymentFor(order.orderId, row.stripeCheckoutSessionId ?? "", row.totalPence);

      expect(await completeShopCheckoutSession(t.db, paid, options)).toBe("unapplied_recorded");

      const after = await orderRow(t, order.orderId);
      expect(after.status).toBe("payment_failed");
      expect(after.paidAt).toBeNull();
      const fulfilments = await t.db
        .select()
        .from(shopFulfilment)
        .where(eq(shopFulfilment.orderId, order.orderId));
      expect(fulfilments).toEqual([]);
      const tasks = await t.db
        .select()
        .from(domainEvent)
        .where(
          and(
            eq(domainEvent.eventType, "payment.unapplied_money_received"),
            sql`${domainEvent.payload}->>'shopOrderId' = ${order.orderId}`,
          ),
        );
      expect(tasks).toHaveLength(1);
      expect(tasks[0]?.payload).toMatchObject({
        reason: "shop_order_paid_while_paused",
        shopOrderId: order.orderId,
        amountCents: row.totalPence,
        stripePaymentIntentId: `pi_paused_${order.orderId}`,
      });
    });

    it("is applied as usual when the artwork is not paused", async () => {
      const t = await setup("pause-backstop-clear");
      const order = await t.repo.createCheckoutOrder(t.request());
      const row = await orderRow(t, order.orderId);
      const options = {
        domainEventMode: "enforce" as const,
        unappliedMoney: new DrizzleUnappliedMoneyReader(t.db),
        moneyPause: t.guard,
      };
      const paid = paymentFor(order.orderId, row.stripeCheckoutSessionId ?? "", row.totalPence);
      expect(await completeShopCheckoutSession(t.db, paid, options)).toBe("processed");
      expect((await orderRow(t, order.orderId)).status).toBe("paid");
    });
  });
});
