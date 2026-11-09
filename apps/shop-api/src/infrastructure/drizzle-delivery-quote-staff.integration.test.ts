import {
  emailOutbox,
  shopDeliveryQuote,
  shopEdition,
  shopOrder,
  shopUserProfile,
} from "@auction/db/schema";
import { DEFAULT_DELIVERY_REGIONS } from "@auction/shop-domain";
import { eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDeliveryQuoteAcceptanceService } from "../application/delivery-quote-acceptance/delivery-quote-acceptance.service.js";
import { createDeliveryQuoteRequestService } from "../application/delivery-quote-request/delivery-quote-request.service.js";
import { createDeliveryQuoteStaffService } from "../application/delivery-quote-staff/delivery-quote-staff.service.js";
import type { PaymentCheckoutGateway } from "../application/ports/commerce.ports.js";
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
import { createDrizzleDeliveryQuoteStaffReader } from "./delivery-quote-staff/drizzle-delivery-quote-staff.store.js";
import {
  createDrizzleDeliveryQuoteOrderReleaser,
  createDrizzleDeliveryQuoteStaffUnitOfWork,
} from "./delivery-quote-staff/drizzle-delivery-quote-staff.unit-of-work.js";
import { createDrizzleCommerceRepository } from "./drizzle-commerce.repository.js";
import { createDrizzleDeliveryQuoteAcceptanceStore } from "./drizzle-delivery-quote-acceptance.store.js";
import { createDrizzleDeliveryQuoteOrderStore } from "./drizzle-delivery-quote-order.store.js";
import { createDrizzleShopNotificationPublisher } from "./drizzle-shop-notification.publisher.js";
import { createDrizzleShopUnitOfWork } from "./drizzle-shop-transaction-effects.js";
import { reapStaleShopCheckouts } from "./shop-checkout-reaper.js";

function recordingGateway() {
  const created: string[] = [];
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
    async expireHostedCheckout() {
      return { kind: "expired" };
    },
  };
  return { gateway, created };
}

const address = {
  recipientName: "Anna Weber",
  line1: "Friedrichstrasse 12",
  city: "Berlin",
  postcode: "10117",
  country: "DE",
};

describe.skipIf(!hasShopIntegrationDb)("quoting and paying a delivery quote", () => {
  let ownerPool!: pg.Pool;
  let shopPool!: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await Promise.allSettled([ownerPool.end(), shopPool.end()]);
  });

  async function setup(label: string, exportPaymentEnabled = true) {
    const db = createShopDb(shopPool);
    const suffix = integrationSuffix(label);
    const imported = await importTestArtwork(db, label, { printPricePence: 8_000 });
    await grantLaxSaleAuthority(db, imported.artworkId, 1);
    const recording = recordingGateway();
    const repo = createDrizzleCommerceRepository(db, recording.gateway, {
      storefrontUrl: "http://localhost:3020",
      domainEventMode: "off",
      exportPaymentEnabled,
    });
    const notifications = createDrizzleShopNotificationPublisher();
    const requests = createDeliveryQuoteRequestService({
      regions: {
        read: async () => ({
          regions: DEFAULT_DELIVERY_REGIONS.map((r) => ({ ...r })),
          restrictedCountries: ["RU"],
        }),
      },
      orders: createDrizzleDeliveryQuoteOrderStore(db, { domainEventMode: "off", notifications }),
      checkout: repo,
      exportPaymentEnabled,
      guestHoldWorkingDays: 1,
    });
    const staff = createDeliveryQuoteStaffService({
      uow: createDrizzleDeliveryQuoteStaffUnitOfWork(createDrizzleShopUnitOfWork(db, "off"), {
        notifications,
        storefrontUrl: "http://localhost:3020",
      }),
      reader: createDrizzleDeliveryQuoteStaffReader(db),
      orders: createDrizzleDeliveryQuoteOrderReleaser(db),
      clock: { now: () => new Date() },
    });
    const acceptance = createDeliveryQuoteAcceptanceService({
      store: createDrizzleDeliveryQuoteAcceptanceStore(db),
      checkout: repo,
      exportPaymentEnabled,
    });
    const subject = `subject-${suffix}`;
    await db
      .insert(shopUserProfile)
      .values({ identitySubjectId: subject, email: `${suffix}@example.test`, name: "Quote Buyer" });
    const requested = async () => {
      const basket = await repo.addOrUpdateLine({
        owner: { kind: "subject", identitySubjectId: subject },
        artworkSlug: imported.slug,
        quantity: 1,
      });
      const outcome = await requests.request({
        subject,
        basketId: basket.basketId,
        idempotencyKey: `delivery-quote:${basket.basketId}`,
        successUrl: "http://localhost:3020/checkout/confirmation?orderId={ORDER_ID}",
        cancelUrl: "http://localhost:3020/checkout/cancel?orderId={ORDER_ID}",
        deliveryAddress: address,
        deliveryPhone: "+49 30 1234567",
        fallbackEmail: `${suffix}@example.test`,
      });
      if (outcome.kind !== "quote_requested") throw new Error("expected a request");
      const [quote] = await db
        .select()
        .from(shopDeliveryQuote)
        .where(eq(shopDeliveryQuote.orderId, outcome.request.orderId));
      return { orderId: outcome.request.orderId, quoteId: requireDefined(quote, "quote").id };
    };
    const quoteOf = async (quoteId: string) =>
      requireDefined(
        (await db.select().from(shopDeliveryQuote).where(eq(shopDeliveryQuote.id, quoteId)))[0],
        "quote",
      );
    const orderOf = async (orderId: string) =>
      requireDefined(
        (await db.select().from(shopOrder).where(eq(shopOrder.id, orderId)).limit(1))[0],
        "order",
      );
    const send = (quoteId: string, pricePence = 8_500) =>
      staff.sendQuote({
        quoteId,
        pricePence,
        carrier: "DHL Express",
        service: "Express insured",
        actorSubjectId: "integration-staff",
        idempotencyKey: `quote-${quoteId}-${pricePence}`,
      });
    const pay = (orderId: string) =>
      acceptance.acceptAndPay({
        subject,
        orderId,
        successUrl: "http://localhost:3020/checkout/confirmation?orderId={ORDER_ID}",
        cancelUrl: "http://localhost:3020/checkout/cancel?orderId={ORDER_ID}",
      });
    return { db, repo, recording, staff, subject, requested, quoteOf, orderOf, send, pay, suffix };
  }

  it("sends a quote: priced, carrier named, hold and reservation run on, buyer emailed", async () => {
    const { db, requested, quoteOf, orderOf, send } = await setup("send");
    const { orderId, quoteId } = await requested();
    const before = await orderOf(orderId);
    await send(quoteId);

    const quote = await quoteOf(quoteId);
    expect(quote.status).toBe("quoted");
    expect(quote.quotedPricePence).toBe(8_500);
    expect(quote.quotedCarrier).toBe("DHL Express");
    expect(quote.quotedBySubjectId).toBe("integration-staff");

    const after = await orderOf(orderId);
    // Nothing is priced into the order until the buyer accepts.
    expect(after.totalPence).toBe(8_000);
    expect(after.fulfilmentSurchargePence).toBe(0);
    expect(after.checkoutExpiresAt?.getTime()).toBeGreaterThan(
      before.checkoutExpiresAt?.getTime() ?? 0,
    );
    const held = await db
      .select()
      .from(shopEdition)
      .where(eq(shopEdition.reservedByOrderId, orderId));
    expect(held[0]?.reservedUntil?.getTime()).toBeGreaterThan(
      before.checkoutExpiresAt?.getTime() ?? 0,
    );

    const mail = await db.select().from(emailOutbox);
    expect(mail.some((row) => row.template === "shop-delivery-quote-ready")).toBe(true);
  });

  it("accepts and pays: the order total is the goods plus the quote, then payment opens", async () => {
    const { requested, send, pay, orderOf, quoteOf, recording } = await setup("accept");
    const { orderId, quoteId } = await requested();
    await send(quoteId);
    const session = await pay(orderId);
    expect(session.checkoutUrl).toContain("pay.example.test");
    const order = await orderOf(orderId);
    expect(order.fulfilmentSurchargePence).toBe(8_500);
    expect(order.totalPence).toBe(8_000 + 8_500);
    expect((await quoteOf(quoteId)).status).toBe("accepted");
    expect(recording.created).toHaveLength(1);
  });

  it("repeats an accept without pricing the order twice", async () => {
    const { requested, send, pay, orderOf } = await setup("accept-twice");
    const { orderId, quoteId } = await requested();
    await send(quoteId);
    await pay(orderId);
    await pay(orderId);
    expect((await orderOf(orderId)).totalPence).toBe(8_000 + 8_500);
  });

  it("opens no payment while payment outside the UK is closed, though a quote can be sent", async () => {
    const { requested, send, pay, quoteOf, orderOf, recording } = await setup("closed", false);
    const { orderId, quoteId } = await requested();
    await send(quoteId);
    expect((await quoteOf(quoteId)).status).toBe("quoted");
    await expect(pay(orderId)).rejects.toMatchObject({ statusCode: 409 });
    // Nothing was accepted or priced.
    expect((await quoteOf(quoteId)).status).toBe("quoted");
    expect((await orderOf(orderId)).totalPence).toBe(8_000);
    expect(recording.created).toEqual([]);
  });

  it("refuses payment when the order total no longer matches the accepted quote", async () => {
    const { db, requested, send, pay, repo, subject } = await setup("mismatch");
    const { orderId, quoteId } = await requested();
    await send(quoteId);
    await pay(orderId);
    // The session exists; tampering with the total must stop a fresh payment being opened.
    await db
      .update(shopOrder)
      .set({ totalPence: 100, stripeCheckoutSessionId: null })
      .where(eq(shopOrder.id, orderId));
    await expect(
      repo.resumeCheckoutOrder({
        subject,
        orderId,
        successUrl: "http://localhost:3020/checkout/confirmation?orderId={ORDER_ID}",
        cancelUrl: "http://localhost:3020/checkout/cancel?orderId={ORDER_ID}",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("will not accept a quote that has expired", async () => {
    const { db, requested, send, pay } = await setup("expired");
    const { orderId, quoteId } = await requested();
    await send(quoteId);
    await db
      .update(shopOrder)
      .set({ checkoutExpiresAt: new Date(Date.now() - 60_000) })
      .where(eq(shopOrder.id, orderId));
    await expect(pay(orderId)).rejects.toMatchObject({ statusCode: 409 });
  });

  it("will not let someone else accept the quote", async () => {
    const { requested, send, orderOf } = await setup("stranger");
    const { orderId, quoteId } = await requested();
    await send(quoteId);
    const db = createShopDb(shopPool);
    const stranger = createDeliveryQuoteAcceptanceService({
      store: createDrizzleDeliveryQuoteAcceptanceStore(db),
      checkout: {
        resumeCheckoutOrder: async () => {
          throw new Error("must not be reached");
        },
      },
      exportPaymentEnabled: true,
    });
    await expect(
      stranger.acceptAndPay({ subject: "someone-else", orderId, successUrl: "x", cancelUrl: "y" }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect((await orderOf(orderId)).totalPence).toBe(8_000);
  });

  it("turns a request down: quote withdrawn, order cancelled, print released, buyer told", async () => {
    const { db, requested, staff, quoteOf, orderOf } = await setup("decline");
    const { orderId, quoteId } = await requested();
    await staff.decline({
      quoteId,
      note: "Our couriers cannot collect framed work there.",
      actorSubjectId: "integration-staff",
      idempotencyKey: `decline-${quoteId}`,
    });
    const quote = await quoteOf(quoteId);
    expect(quote.status).toBe("withdrawn");
    expect(quote.endReason).toBe("cannot_deliver");
    expect(quote.declineNote).toContain("framed work");
    expect((await orderOf(orderId)).status).toBe("cancelled");
    const held = await db
      .select()
      .from(shopEdition)
      .where(eq(shopEdition.reservedByOrderId, orderId));
    expect(held).toHaveLength(0);
    const mail = await db.select().from(emailOutbox);
    expect(mail.some((row) => row.template === "shop-delivery-quote-declined")).toBe(true);
  });

  it("lets the hold pass on a sent quote: the quote ends as expired", async () => {
    const { db, requested, send, quoteOf } = await setup("lapse");
    const { quoteId } = await requested();
    await send(quoteId);
    const [row] = await db
      .select({ holdUntil: shopDeliveryQuote.holdUntil })
      .from(shopDeliveryQuote)
      .where(eq(shopDeliveryQuote.id, quoteId));
    await reapStaleShopCheckouts(
      db,
      new Date(requireDefined(row, "quote").holdUntil.getTime() + 120_000),
    );
    const quote = await quoteOf(quoteId);
    expect(quote.status).toBe("withdrawn");
    expect(quote.endReason).toBe("expired");
  });
});
