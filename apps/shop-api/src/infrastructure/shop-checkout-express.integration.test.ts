import { shopBasket, shopEdition, shopOrder } from "@auction/db/schema";
import { EXPRESS_CHECKOUT_SOLD_OUT_MESSAGE, SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { and, eq } from "drizzle-orm";
import type pg from "pg";
import type Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createExpressCheckoutService } from "../application/express-checkout/express-checkout.service.js";
import type {
  CheckoutOrderInput,
  PaymentCheckoutGateway,
} from "../application/ports/commerce.ports.js";
import type {
  ExpressCheckoutGateway,
  ExpressShippingRate,
} from "../application/ports/express-checkout.ports.js";
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
import { completeShopCheckoutSession } from "./drizzle-payment-event.processor.js";
import { createDrizzleExpressCheckoutBasketReader } from "./shop-express-checkout-basket.js";
import { parseCheckoutSessionCompleted } from "./stripe-webhook.dto.js";

const STOREFRONT = "http://localhost:3020";
const ADDRESS = {
  recipientName: "Ada Lovelace",
  line1: "1 High Street",
  city: "London",
  postcode: "sw1a 1aa",
  country: "GB",
};

type FakeSession = {
  id: string;
  basketId: string;
  subtotalPence: number;
  rates: ExpressShippingRate[];
  status: "open" | "complete" | "expired";
  orderId: string | null;
  orderReference: string | null;
  shippingName: string | null;
};

/** Stripe's Elements-mode sessions, in memory: what the Shop asks for and what it would get back. */
function fakeStripe() {
  const sessions = new Map<string, FakeSession>();
  const expired: string[] = [];
  const keys: string[] = [];
  let created = 0;
  const express: ExpressCheckoutGateway = {
    async createExpressCheckout(input) {
      created += 1;
      keys.push(input.idempotencyKey);
      const id = `cs_test_express${created}x${input.basketId.slice(0, 8)}`;
      sessions.set(id, {
        id,
        basketId: input.basketId,
        subtotalPence: input.subtotalPence,
        rates: [...input.shippingRates],
        status: "open",
        orderId: null,
        orderReference: null,
        shippingName: null,
      });
      return { sessionId: id, clientSecret: `${id}_secret_x`, expiresAt: input.expiresAt };
    },
    async readExpressCheckout({ sessionId }) {
      const session = sessions.get(sessionId);
      if (!session) return null;
      return {
        sessionId,
        status: session.status,
        isShopExpress: true,
        basketId: session.basketId,
        orderId: session.orderId,
        currency: "gbp",
        amountSubtotalPence: session.subtotalPence,
      };
    },
    async bindExpressCheckout(input) {
      const session = requireDefined(sessions.get(input.sessionId), "session");
      session.orderId = input.orderId;
      session.orderReference = input.orderReference;
      session.rates = [input.shippingRate];
      session.shippingName = input.shipping.name;
      return { amountTotalPence: session.subtotalPence + input.shippingRate.amountPence };
    },
  };
  const hosted: PaymentCheckoutGateway = {
    async createHostedCheckout(input) {
      const sessionId = `cs_test_hosted_${input.orderId}`;
      return { sessionId, paymentIntentId: null, checkoutUrl: `https://pay.test/${sessionId}` };
    },
    async resolveHostedCheckout(input) {
      return { checkoutUrl: `https://pay.test/${input.sessionId}` };
    },
    retrievePaidCheckout: async () => null,
    async expireHostedCheckout(input) {
      expired.push(input.sessionId);
      const session = sessions.get(input.sessionId);
      if (session) session.status = "expired";
      return { kind: "expired" };
    },
  };
  return { express, hosted, sessions, expired, keys, createdCount: () => created };
}

/** What Stripe would send when the shopper pays in the sheet. */
function completedEvent(session: FakeSession, amountTotal: number, id: string): Stripe.Event {
  return {
    id,
    object: "event",
    type: "checkout.session.completed",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    data: {
      object: {
        id: session.id,
        object: "checkout.session",
        ui_mode: "custom",
        mode: "payment",
        status: "complete",
        payment_status: "paid",
        currency: "gbp",
        amount_total: amountTotal,
        payment_intent: `pi_${session.id}`,
        customer_details: { email: "ada@example.com" },
        metadata: {
          app: "shop",
          checkout: "express",
          basketId: session.basketId,
          ...(session.orderId ? { orderId: session.orderId } : {}),
          ...(session.orderReference ? { orderReference: session.orderReference } : {}),
        },
      },
    },
  } as unknown as Stripe.Event;
}

describe.skipIf(!hasShopIntegrationDb)("express checkout (wallets) on Checkout Sessions", () => {
  let ownerPool!: pg.Pool;
  let shopPool!: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await Promise.allSettled([ownerPool.end(), shopPool.end()]);
  });

  async function setup(label: string, options: { express?: boolean } = {}) {
    const db = createShopDb(shopPool);
    const suffix = integrationSuffix(label);
    const imported = await importTestArtwork(db, label, { printPricePence: 8_000 });
    await grantLaxSaleAuthority(db, imported.artworkId, 1);
    const stripe = fakeStripe();
    const repo = createDrizzleCommerceRepository(db, stripe.hosted, {
      storefrontUrl: STOREFRONT,
      domainEventMode: "off",
      ...(options.express === false ? {} : { expressGateway: stripe.express }),
    });
    const service = createExpressCheckoutService({
      baskets: createDrizzleExpressCheckoutBasketReader(db, {
        merchandiseEnabled: false,
        framingEnabled: false,
        editionOrderLimit: null,
      }),
      gateway: stripe.express,
      storefrontUrl: STOREFRONT,
    });
    const subject = `subject-${suffix}`;
    const owner = { kind: "subject" as const, identitySubjectId: subject };
    const basket = await repo.addOrUpdateLine({ owner, artworkSlug: imported.slug, quantity: 1 });
    const confirm = (
      sessionId: string,
      overrides: Partial<Parameters<typeof service.confirm>[0]> = {},
    ) =>
      service.confirm(
        {
          owner,
          basketId: basket.basketId,
          sessionId,
          shippingRateId: "uk_insured_delivery",
          name: "Ada Lovelace",
          phone: "07700 900123",
          shippingAddress: ADDRESS,
          ...overrides,
        },
        (order) => repo.createCheckoutOrder({ ...order, subject }),
      );
    const ordersFor = (sub: string) =>
      db.select().from(shopOrder).where(eq(shopOrder.identitySubjectId, sub));
    const heldBy = (orderId: string) =>
      db.select().from(shopEdition).where(eq(shopEdition.reservedByOrderId, orderId));
    const order = async (orderId: string) =>
      requireDefined(
        (await db.select().from(shopOrder).where(eq(shopOrder.id, orderId)).limit(1))[0],
        "order",
      );
    return {
      db,
      repo,
      service,
      stripe,
      subject,
      owner,
      basket,
      imported,
      confirm,
      ordersFor,
      heldBy,
      order,
      suffix,
    };
  }

  it("opens a session for the basket with both UK rates, and orders and holds nothing", async () => {
    const { service, stripe, owner, basket, subject, ordersFor } = await setup("express-start");
    const session = await service.start({ owner, basketId: basket.basketId });
    expect(session.subtotalPence).toBe(8_000);
    expect(session.shippingRates).toEqual([
      { id: "uk_insured_delivery", displayName: "Insured UK delivery", amountPence: 1_500 },
      {
        id: "collect_new_cavendish",
        displayName: "Collect from our London gallery",
        amountPence: 0,
      },
    ]);
    expect(stripe.sessions.get(session.sessionId)?.basketId).toBe(basket.basketId);
    expect(await ordersFor(subject)).toEqual([]);

    // Opening it again for the same basket asks Stripe with the same idempotency key, so Stripe
    // hands back the same session.
    await service.start({ owner, basketId: basket.basketId });
    expect(stripe.keys).toHaveLength(2);
    expect(stripe.keys[1]).toBe(stripe.keys[0]);
    expect(stripe.keys[0]).toMatch(new RegExp(`^checkout:shop-express:${basket.basketId}:`));
  });

  it("makes the order and holds the print only on confirm, and the webhook settles it", async () => {
    const {
      db,
      service,
      stripe,
      owner,
      basket,
      subject,
      confirm,
      ordersFor,
      heldBy,
      order,
      suffix,
    } = await setup("express-confirm");
    const { sessionId } = await service.start({ owner, basketId: basket.basketId });
    expect(await ordersFor(subject)).toEqual([]);

    const confirmed = await confirm(sessionId);
    expect(confirmed.checkoutUrl).toBe(
      `${STOREFRONT}/checkout/confirmation?orderId=${confirmed.orderId}`,
    );
    const row = await order(confirmed.orderId);
    expect(row).toMatchObject({
      status: "pending_payment",
      fulfilment: "uk_insured_delivery",
      fulfilmentSurchargePence: 1_500,
      totalPence: 9_500,
      stripeCheckoutSessionId: sessionId,
      idempotencyKey: `express:${sessionId}`,
      deliveryRecipientName: "Ada Lovelace",
      deliveryPostcode: "SW1A 1AA",
      deliveryPhone: "07700 900123",
    });
    expect(await heldBy(confirmed.orderId)).toHaveLength(1);
    const [retired] = await db.select().from(shopBasket).where(eq(shopBasket.id, basket.basketId));
    expect(retired?.retiredAt).not.toBeNull();

    // Stripe's session now names the order, so the webhook finds it the way it finds a hosted one.
    const session = requireDefined(stripe.sessions.get(sessionId), "session");
    expect(session.orderId).toBe(confirmed.orderId);
    expect(session.orderReference).toBe(row.reference);
    expect(session.rates.map((rate) => rate.id)).toEqual(["uk_insured_delivery"]);

    const paid = requireDefined(
      parseCheckoutSessionCompleted(completedEvent(session, 9_500, `evt_${suffix}`)),
      "dto",
    );
    expect(paid).toMatchObject({ orderId: confirmed.orderId, sessionId, amountTotalPence: 9_500 });
    expect(await completeShopCheckoutSession(db, paid, { domainEventMode: "off" })).toBe(
      "processed",
    );
    expect(await order(confirmed.orderId)).toMatchObject({ status: "paid" });
    expect(await ordersFor(subject)).toHaveLength(1);
  });

  it("charges nothing for collection and keeps no delivery address on the order", async () => {
    const { service, stripe, owner, basket, confirm, order } = await setup("express-collect");
    const { sessionId } = await service.start({ owner, basketId: basket.basketId });
    const confirmed = await confirm(sessionId, {
      shippingRateId: "collect_new_cavendish",
      phone: undefined,
    });
    expect(await order(confirmed.orderId)).toMatchObject({
      fulfilment: "collect_new_cavendish",
      fulfilmentSurchargePence: 0,
      totalPence: 8_000,
      deliveryLine1: null,
      deliveryPostcode: null,
    });
    expect(stripe.sessions.get(sessionId)?.rates).toEqual([
      {
        id: "collect_new_cavendish",
        displayName: "Collect from our London gallery",
        amountPence: 0,
      },
    ]);
  });

  it("fails the confirm with 'This print has just sold out' when the print sold meanwhile", async () => {
    const { db, repo, service, owner, basket, imported, confirm, ordersFor, subject, suffix } =
      await setup("express-sold-out");
    const { sessionId } = await service.start({ owner, basketId: basket.basketId });

    // Someone else buys the only copy while the sheet is open.
    const rival = `rival-${suffix}`;
    const rivalBasket = await repo.addOrUpdateLine({
      owner: { kind: "subject", identitySubjectId: rival },
      artworkSlug: imported.slug,
      quantity: 1,
    });
    const request: CheckoutOrderInput = {
      subject: rival,
      basketId: rivalBasket.basketId,
      fulfilment: "collect_new_cavendish",
      idempotencyKey: `checkout:${rivalBasket.basketId}`,
      successUrl: `${STOREFRONT}/checkout/confirmation?orderId={ORDER_ID}`,
      cancelUrl: `${STOREFRONT}/checkout/cancel?orderId={ORDER_ID}`,
    };
    await repo.createCheckoutOrder(request);

    await expect(confirm(sessionId)).rejects.toMatchObject({
      code: SHOP_API_ERROR_CODES.OUT_OF_STOCK,
      statusCode: 409,
      message: EXPRESS_CHECKOUT_SOLD_OUT_MESSAGE,
    });
    expect(await ordersFor(subject)).toEqual([]);
    const [open] = await db.select().from(shopBasket).where(eq(shopBasket.id, basket.basketId));
    expect(open?.retiredAt).toBeNull();
  });

  it("returns to the same order on a repeated confirm, and reprices it on the same session", async () => {
    const { service, stripe, owner, basket, confirm, order, heldBy } =
      await setup("express-replay");
    const { sessionId } = await service.start({ owner, basketId: basket.basketId });
    const first = await confirm(sessionId);
    const second = await confirm(sessionId);
    expect(second.orderId).toBe(first.orderId);

    const collect = await confirm(sessionId, {
      shippingRateId: "collect_new_cavendish",
      phone: undefined,
    });
    expect(collect.orderId).toBe(first.orderId);
    expect(await order(first.orderId)).toMatchObject({
      fulfilment: "collect_new_cavendish",
      totalPence: 8_000,
      stripeCheckoutSessionId: sessionId,
    });
    expect(stripe.expired).toEqual([]);
    expect(stripe.sessions.get(sessionId)?.rates.map((rate) => rate.id)).toEqual([
      "collect_new_cavendish",
    ]);
    expect(await heldBy(first.orderId)).toHaveLength(1);
  });

  it("refuses a session whose basket changed, and puts the print and the basket back", async () => {
    const { db, service, stripe, owner, basket, confirm, ordersFor, subject, imported } =
      await setup("express-changed");
    const { sessionId } = await service.start({ owner, basketId: basket.basketId });
    requireDefined(stripe.sessions.get(sessionId), "session").subtotalPence = 7_000;

    await expect(confirm(sessionId)).rejects.toMatchObject({
      code: SHOP_API_ERROR_CODES.PRICE_CHANGED,
      statusCode: 409,
    });
    const [cancelled] = await ordersFor(subject);
    expect(cancelled?.status).toBe("cancelled");
    const stillHeld = await db
      .select()
      .from(shopEdition)
      .where(
        and(
          eq(shopEdition.artworkId, imported.artworkId),
          eq(shopEdition.listingStatus, "reserved"),
        ),
      );
    expect(stillHeld).toEqual([]);
    expect(requireDefined(stripe.sessions.get(sessionId), "session").orderId).toBeNull();
  });

  it("refuses a session opened for another basket before anything is held", async () => {
    const { service, stripe, owner, basket, confirm, ordersFor, subject } =
      await setup("express-foreign");
    const { sessionId } = await service.start({ owner, basketId: basket.basketId });
    requireDefined(stripe.sessions.get(sessionId), "session").basketId =
      "00000000-0000-4000-8000-000000000000";
    await expect(confirm(sessionId)).rejects.toMatchObject({ statusCode: 404 });
    expect(await ordersFor(subject)).toEqual([]);
  });

  it("refuses a session that has ended before anything is held", async () => {
    const { service, stripe, owner, basket, confirm, ordersFor, subject } =
      await setup("express-ended");
    const { sessionId } = await service.start({ owner, basketId: basket.basketId });
    requireDefined(stripe.sessions.get(sessionId), "session").status = "expired";
    await expect(confirm(sessionId)).rejects.toMatchObject({ statusCode: 409 });
    expect(await ordersFor(subject)).toEqual([]);
  });

  it("makes no order for an express confirm while express checkout is off", async () => {
    const { confirm, ordersFor, subject } = await setup("express-off", { express: false });
    await expect(confirm("cs_test_offline")).rejects.toMatchObject({
      code: SHOP_API_ERROR_CODES.FEATURE_DISABLED,
    });
    expect(await ordersFor(subject)).toEqual([]);
  });

  it("leaves the hosted page flow as it was", async () => {
    const { repo, basket, subject, order, stripe } = await setup("express-hosted-unchanged");
    const created = await repo.createCheckoutOrder({
      subject,
      basketId: basket.basketId,
      fulfilment: "collect_new_cavendish",
      idempotencyKey: `checkout:${basket.basketId}:hosted`,
      successUrl: `${STOREFRONT}/checkout/confirmation?orderId={ORDER_ID}`,
      cancelUrl: `${STOREFRONT}/checkout/cancel?orderId={ORDER_ID}`,
    });
    expect(created.checkoutUrl).toBe(`https://pay.test/cs_test_hosted_${created.orderId}`);
    expect((await order(created.orderId)).stripeCheckoutSessionId).toBe(
      `cs_test_hosted_${created.orderId}`,
    );
    expect(stripe.createdCount()).toBe(0);
  });
});
