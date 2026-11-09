import {
  emailOutbox,
  shopBasket,
  shopDeliveryQuote,
  shopEdition,
  shopGuestCustomer,
  shopOrder,
} from "@auction/db/schema";
import {
  DEFAULT_DELIVERY_REGIONS,
  MAX_OPEN_QUOTE_REQUESTS_PER_BASKET_TOKEN,
  MAX_OPEN_QUOTE_REQUESTS_PER_BUYER,
  MAX_OPEN_QUOTE_REQUESTS_PER_GUEST_IP,
} from "@auction/shop-domain";
import { eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDeliveryQuoteRequestService } from "../application/delivery-quote-request/delivery-quote-request.service.js";
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
import { createDrizzleCommerceRepository } from "./drizzle-commerce.repository.js";
import { createDrizzleDeliveryQuoteOrderStore } from "./drizzle-delivery-quote-order.store.js";
import { createDrizzleShopNotificationPublisher } from "./drizzle-shop-notification.publisher.js";
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

const address = (country: string) => ({
  recipientName: "Anna Weber",
  line1: "Friedrichstrasse 12",
  city: "Berlin",
  postcode: "10117",
  country,
});

describe.skipIf(!hasShopIntegrationDb)("delivery quote requests", () => {
  let ownerPool!: pg.Pool;
  let shopPool!: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await Promise.allSettled([ownerPool.end(), shopPool.end()]);
  });

  async function setup(
    label: string,
    regions = DEFAULT_DELIVERY_REGIONS.map((r) => ({ ...r })),
    authorised = 1,
    exportPaymentEnabled = true,
  ) {
    const db = createShopDb(shopPool);
    const suffix = integrationSuffix(label);
    const imported = await importTestArtwork(db, label, { printPricePence: 8_000 });
    await grantLaxSaleAuthority(db, imported.artworkId, authorised);
    const recording = recordingGateway();
    const repo = createDrizzleCommerceRepository(db, recording.gateway, {
      storefrontUrl: "http://localhost:3020",
      domainEventMode: "off",
    });
    const subject = `subject-${suffix}`;
    const addBasket = () =>
      repo.addOrUpdateLine({
        owner: { kind: "subject", identitySubjectId: subject },
        artworkSlug: imported.slug,
        quantity: 1,
      });
    const quotes = createDeliveryQuoteRequestService({
      regions: { read: async () => ({ regions, restrictedCountries: ["RU"] }) },
      orders: createDrizzleDeliveryQuoteOrderStore(db, {
        domainEventMode: "off",
        notifications: createDrizzleShopNotificationPublisher(),
      }),
      checkout: repo,
      exportPaymentEnabled,
      guestHoldWorkingDays: 1,
    });
    const newGuest = async (token: string, ip: string) => {
      const [row] = await db
        .insert(shopGuestCustomer)
        .values({ email: `${integrationSuffix("guest")}@example.test` })
        .returning({ id: shopGuestCustomer.id });
      return { id: requireDefined(row, "guest").id, token, ip };
    };
    const guestBasket = (token: string) =>
      repo.addOrUpdateLine({
        owner: { kind: "anonymous", tokenHash: token },
        artworkSlug: imported.slug,
        quantity: 1,
      });
    const guestRequest = (
      basketId: string,
      guest: { id: string; token: string; ip: string },
      key = `delivery-quote:${basketId}`,
    ) =>
      quotes.request({
        subject: `guest:${guest.id}`,
        guest: { guestCustomerId: guest.id, basketTokenHash: guest.token },
        guestIpHash: guest.ip,
        basketId,
        idempotencyKey: key,
        successUrl: "http://localhost:3020/checkout/confirmation?orderId={ORDER_ID}",
        cancelUrl: "http://localhost:3020/checkout/cancel?orderId={ORDER_ID}",
        deliveryAddress: address("DE"),
        deliveryPhone: "+49 30 1234567",
        fallbackEmail: `${suffix}@example.test`,
      });
    const request = (basketId: string, country = "DE", key = `delivery-quote:${basketId}`) =>
      quotes.request({
        subject,
        basketId,
        idempotencyKey: key,
        successUrl: "http://localhost:3020/checkout/confirmation?orderId={ORDER_ID}",
        cancelUrl: "http://localhost:3020/checkout/cancel?orderId={ORDER_ID}",
        deliveryAddress: address(country),
        deliveryPhone: "+49 30 1234567",
        fallbackEmail: `${suffix}@example.test`,
      });
    const quoteFor = async (orderId: string) =>
      requireDefined(
        (
          await db.select().from(shopDeliveryQuote).where(eq(shopDeliveryQuote.orderId, orderId))
        )[0],
        "quote",
      );
    const order = async (orderId: string) =>
      requireDefined(
        (await db.select().from(shopOrder).where(eq(shopOrder.id, orderId)).limit(1))[0],
        "order",
      );
    return {
      db,
      repo,
      recording,
      subject,
      imported,
      addBasket,
      request,
      guestRequest,
      newGuest,
      guestBasket,
      quoteFor,
      order,
      suffix,
    };
  }

  it("holds the print for three working days without opening a payment", async () => {
    const { db, request, addBasket, quoteFor, order, recording, imported } = await setup("hold");
    const basket = await addBasket();
    const outcome = await request(basket.basketId);
    if (outcome.kind !== "quote_requested") throw new Error(`expected a request: ${outcome.kind}`);
    const row = await order(outcome.request.orderId);
    expect(row.status).toBe("pending_payment");
    expect(row.fulfilment).toBe("international_quotation");
    expect(row.stripeCheckoutSessionId).toBeNull();
    expect(row.fulfilmentSurchargePence).toBe(0);
    expect(row.totalPence).toBe(8_000);
    expect(row.deliveryCountry).toBe("DE");
    expect(row.checkoutExpiresAt?.getTime()).toBe(outcome.request.holdUntil.getTime());
    expect(recording.created).toEqual([]);

    const quote = await quoteFor(outcome.request.orderId);
    expect(quote.status).toBe("requested");
    expect(quote.regionId).toBe("eu");
    expect(quote.destinationCountry).toBe("DE");

    const held = await db
      .select()
      .from(shopEdition)
      .where(eq(shopEdition.reservedByOrderId, outcome.request.orderId));
    expect(held).toHaveLength(1);
    expect(held[0]?.listingStatus).toBe("reserved");
    expect(held[0]?.artworkId).toBe(imported.artworkId);
    // Held to the end of the hold, plus the usual minute's grace.
    expect(held[0]?.reservedUntil?.getTime()).toBe(outcome.request.holdUntil.getTime() + 60_000);

    const basketRow = await db.select().from(shopBasket).where(eq(shopBasket.id, basket.basketId));
    expect(basketRow[0]?.retiredAt).not.toBeNull();
  });

  it("queues the buyer's email in the same step", async () => {
    const { db, request, addBasket, suffix } = await setup("email");
    const basket = await addBasket();
    const outcome = await request(basket.basketId);
    if (outcome.kind !== "quote_requested") throw new Error("expected a request");
    const mail = await db
      .select()
      .from(emailOutbox)
      .where(eq(emailOutbox.idempotencyKey, `delivery-quote-requested:${outcome.request.orderId}`));
    expect(mail).toHaveLength(1);
    expect(mail[0]?.template).toBe("shop-delivery-quote-requested");
    expect(JSON.stringify(mail[0]?.vars)).toContain("Germany");
    expect(mail[0]?.toSnapshot ?? "").toContain(suffix);
  });

  it("returns the same request for a retry, without a second hold", async () => {
    const { db, request, addBasket } = await setup("replay");
    const basket = await addBasket();
    const first = await request(basket.basketId);
    const [second, third] = await Promise.all([request(basket.basketId), request(basket.basketId)]);
    for (const again of [second, third]) {
      if (first.kind !== "quote_requested" || again.kind !== "quote_requested") {
        throw new Error("expected requests");
      }
      expect(again.request.orderId).toBe(first.request.orderId);
    }
    if (first.kind !== "quote_requested") throw new Error("expected a request");
    const quotes = await db
      .select()
      .from(shopDeliveryQuote)
      .where(eq(shopDeliveryQuote.orderId, first.request.orderId));
    expect(quotes).toHaveLength(1);
  });

  it("will not open a payment for an order waiting on its quote", async () => {
    const { repo, request, addBasket, subject } = await setup("no-pay");
    const basket = await addBasket();
    const outcome = await request(basket.basketId);
    if (outcome.kind !== "quote_requested") throw new Error("expected a request");
    await expect(
      repo.resumeCheckoutOrder({
        subject,
        orderId: outcome.request.orderId,
        successUrl: "http://localhost:3020/checkout/confirmation?orderId={ORDER_ID}",
        cancelUrl: "http://localhost:3020/checkout/cancel?orderId={ORDER_ID}",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("releases the print and returns the basket when the hold passes unpaid", async () => {
    const { db, request, addBasket, quoteFor, order } = await setup("expire");
    const basket = await addBasket();
    const outcome = await request(basket.basketId);
    if (outcome.kind !== "quote_requested") throw new Error("expected a request");
    const later = new Date(outcome.request.holdUntil.getTime() + 60_000);
    expect(await reapStaleShopCheckouts(db, later)).toBeGreaterThanOrEqual(1);

    expect((await order(outcome.request.orderId)).status).toBe("expired");
    const quote = await quoteFor(outcome.request.orderId);
    expect(quote.status).toBe("withdrawn");
    expect(quote.endReason).toBe("expired");
    const held = await db
      .select()
      .from(shopEdition)
      .where(eq(shopEdition.reservedByOrderId, outcome.request.orderId));
    expect(held).toHaveLength(0);
  });

  it("ends the request as cancelled when the buyer cancels", async () => {
    const { repo, request, addBasket, quoteFor, order, subject } = await setup("cancel");
    const basket = await addBasket();
    const outcome = await request(basket.basketId);
    if (outcome.kind !== "quote_requested") throw new Error("expected a request");
    await repo.cancelCheckoutOrder({ subject, orderId: outcome.request.orderId });
    expect((await order(outcome.request.orderId)).status).toBe("cancelled");
    const quote = await quoteFor(outcome.request.orderId);
    expect(quote.status).toBe("withdrawn");
    expect(quote.endReason).toBe("cancelled_by_buyer");
  });

  it("caps how many requests one buyer can have waiting", async () => {
    const { request, addBasket } = await setup(
      "cap",
      DEFAULT_DELIVERY_REGIONS.map((r) => ({ ...r })),
      MAX_OPEN_QUOTE_REQUESTS_PER_BUYER + 1,
    );
    // Each request retires its basket, so every attempt starts from a new one.
    for (let i = 0; i < MAX_OPEN_QUOTE_REQUESTS_PER_BUYER; i++) {
      const basket = await addBasket();
      const outcome = await request(basket.basketId, "DE", `delivery-quote:cap:${i}`);
      expect(outcome.kind).toBe("quote_requested");
    }
    const basket = await addBasket();
    await expect(request(basket.basketId, "DE", "delivery-quote:cap:over")).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("refuses an export-restricted country and holds nothing", async () => {
    const { db, request, addBasket, imported } = await setup("restricted");
    const basket = await addBasket();
    const outcome = await request(basket.basketId, "RU");
    expect(outcome).toEqual({ kind: "not_delivered", country: "RU" });
    const held = await db
      .select()
      .from(shopEdition)
      .where(eq(shopEdition.artworkId, imported.artworkId));
    expect(held.every((edition) => edition.reservedByOrderId === null)).toBe(true);
  });

  it("charges a region's fixed rate in one payment with the print", async () => {
    const regions = DEFAULT_DELIVERY_REGIONS.map((r) =>
      r.id === "eu" ? { ...r, fixedPricePence: 3_500 } : { ...r },
    );
    const { request, addBasket, order, recording } = await setup("fixed", regions);
    const basket = await addBasket();
    const outcome = await request(basket.basketId);
    if (outcome.kind !== "pay_now") throw new Error(`expected payment: ${outcome.kind}`);
    const row = await order(outcome.session.orderId);
    expect(row.fulfilmentSurchargePence).toBe(3_500);
    expect(row.totalPence).toBe(8_000 + 3_500);
    expect(row.fulfilment).toBe("international_quotation");
    expect(recording.created).toHaveLength(1);
  });

  it("asks for a quote instead of charging a fixed rate while export payment is off", async () => {
    const regions = DEFAULT_DELIVERY_REGIONS.map((r) =>
      r.id === "eu" ? { ...r, fixedPricePence: 3_500 } : { ...r },
    );
    const { request, addBasket, order, quoteFor, recording } = await setup(
      "flag-off",
      regions,
      1,
      false,
    );
    const basket = await addBasket();
    const outcome = await request(basket.basketId);
    if (outcome.kind !== "quote_requested") throw new Error(`expected a request: ${outcome.kind}`);
    const row = await order(outcome.request.orderId);
    // Nothing is priced into the order and no payment is opened.
    expect(row.fulfilmentSurchargePence).toBe(0);
    expect(row.totalPence).toBe(8_000);
    expect(recording.created).toEqual([]);
    expect((await quoteFor(outcome.request.orderId)).status).toBe("requested");
  });

  it("holds a guest's print for one working day, and records who asked only as hashes", async () => {
    const { guestRequest, newGuest, guestBasket, quoteFor } = await setup("guest-hold");
    const guest = await newGuest("token-a", "ip-hash-a");
    const basket = await guestBasket(guest.token);
    const outcome = await guestRequest(basket.basketId, guest);
    if (outcome.kind !== "quote_requested") throw new Error("expected a request");
    const quote = await quoteFor(outcome.request.orderId);
    expect(quote.guestIpHash).toBe("ip-hash-a");
    expect(quote.basketTokenHash).toBe("token-a");
    // One working day from now, not three.
    const hours = (quote.holdUntil.getTime() - quote.requestedAt.getTime()) / 3_600_000;
    expect(hours).toBeGreaterThanOrEqual(23);
    expect(hours).toBeLessThanOrEqual(24 * 4);
  });

  it("caps open holds per browser whatever email it gives", async () => {
    const { guestRequest, newGuest, guestBasket } = await setup(
      "guest-token-cap",
      DEFAULT_DELIVERY_REGIONS.map((r) => ({ ...r })),
      MAX_OPEN_QUOTE_REQUESTS_PER_BASKET_TOKEN + 1,
    );
    // The same browser (basket token) as three different guests, each from a different network.
    for (let i = 0; i < MAX_OPEN_QUOTE_REQUESTS_PER_BASKET_TOKEN; i++) {
      const guest = await newGuest("shared-token", `ip-${i}`);
      const basket = await guestBasket(guest.token);
      expect((await guestRequest(basket.basketId, guest)).kind).toBe("quote_requested");
    }
    const another = await newGuest("shared-token", "ip-other");
    const basket = await guestBasket(another.token);
    await expect(guestRequest(basket.basketId, another)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("caps open holds per network, whatever browser or email", async () => {
    // A run holds at most 4 prints, so the network's holds are spread over two works.
    const first = await setup(
      "guest-ip-cap-a",
      DEFAULT_DELIVERY_REGIONS.map((r) => ({ ...r })),
      3,
    );
    const second = await setup(
      "guest-ip-cap-b",
      DEFAULT_DELIVERY_REGIONS.map((r) => ({ ...r })),
      3,
    );
    const network = `shared-ip-${first.suffix}`;
    const holds = [first, first, first, second];
    expect(holds).toHaveLength(MAX_OPEN_QUOTE_REQUESTS_PER_GUEST_IP);
    for (const [i, shop] of holds.entries()) {
      const guest = await shop.newGuest(`token-${first.suffix}-${i}`, network);
      const basket = await shop.guestBasket(guest.token);
      expect((await shop.guestRequest(basket.basketId, guest)).kind).toBe("quote_requested");
    }
    const another = await second.newGuest(`token-${first.suffix}-fresh`, network);
    const basket = await second.guestBasket(another.token);
    await expect(second.guestRequest(basket.basketId, another)).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});
