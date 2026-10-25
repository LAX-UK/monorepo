import { shopOrder } from "@auction/db/schema";
import { eq } from "drizzle-orm";
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
import { completeShopCheckoutSession } from "./drizzle-payment-event.processor.js";

/** A payment provider double: a unique session per call, and a record of expired sessions. */
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
    async expireHostedCheckout(input) {
      expired.push(input.sessionId);
      return { kind: "expired" };
    },
  };
  return { gateway, created, expired };
}

/** The same request for collection: no address or phone. */
function withoutDelivery({
  deliveryAddress: _address,
  deliveryPhone: _phone,
  ...rest
}: CheckoutOrderInput): CheckoutOrderInput {
  return { ...rest, fulfilment: "collect_new_cavendish" };
}

describe.skipIf(!hasShopIntegrationDb)("checkout retries with changed delivery details", () => {
  let ownerPool!: pg.Pool;
  let shopPool!: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await Promise.allSettled([ownerPool.end(), shopPool.end()]);
  });

  async function setup(label: string) {
    const db = createShopDb(shopPool);
    const suffix = integrationSuffix(label);
    const imported = await importTestArtwork(db, label, { printPricePence: 8_000 });
    await grantLaxSaleAuthority(db, imported.artworkId, 1);
    const recording = recordingGateway();
    const repo = createDrizzleCommerceRepository(db, recording.gateway, {
      storefrontUrl: "http://localhost:3020",
      domainEventMode: "off",
    });
    const subject = `subject-${suffix}`;
    const basket = await repo.addOrUpdateLine({
      owner: { kind: "subject", identitySubjectId: subject },
      artworkSlug: imported.slug,
      quantity: 1,
    });
    const request = (overrides: Partial<CheckoutOrderInput> = {}): CheckoutOrderInput => ({
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
      ...overrides,
    });
    const order = async (orderId: string) =>
      requireDefined(
        (await db.select().from(shopOrder).where(eq(shopOrder.id, orderId)).limit(1))[0],
        "order",
      );
    const ordersForKey = async (key: string) =>
      db.select({ id: shopOrder.id }).from(shopOrder).where(eq(shopOrder.idempotencyKey, key));
    return { db, repo, recording, request, order, ordersForKey, suffix };
  }

  it("reuses the same order for an unchanged retry, even two at once", async () => {
    const { repo, recording, request, ordersForKey } = await setup("replay-same");
    const first = await repo.createCheckoutOrder(request());
    const [second, third] = await Promise.all([
      repo.createCheckoutOrder(request()),
      repo.createCheckoutOrder(request()),
    ]);
    expect(second.orderId).toBe(first.orderId);
    expect(third.orderId).toBe(first.orderId);
    expect(second.checkoutUrl).toBe(first.checkoutUrl);
    expect(await ordersForKey(request().idempotencyKey)).toHaveLength(1);
    expect(recording.created).toHaveLength(1);
    expect(recording.expired).toEqual([]);
  });

  it("pays the order with the address submitted last", async () => {
    const { db, repo, request, order, suffix } = await setup("replay-address");
    const first = await repo.createCheckoutOrder(request());
    const retried = await repo.createCheckoutOrder(
      request({
        deliveryAddress: {
          recipientName: "Grace Hopper",
          line1: "27 Albion Street",
          city: "Leeds",
          postcode: "ls1 5ar",
          country: "GB",
        },
        deliveryPhone: "07700 900456",
      }),
    );
    expect(retried.orderId).toBe(first.orderId);

    const updated = await order(first.orderId);
    const outcome = await completeShopCheckoutSession(
      db,
      {
        eventId: `evt-${suffix}`,
        orderId: updated.id,
        sessionId: requireDefined(updated.stripeCheckoutSessionId, "session"),
        amountTotalPence: updated.totalPence,
        paidAt: new Date(),
      },
      { domainEventMode: "off" },
    );
    expect(outcome).toBe("processed");
    expect(await order(first.orderId)).toMatchObject({
      status: "paid",
      deliveryRecipientName: "Grace Hopper",
      deliveryLine1: "27 Albion Street",
      deliveryCity: "Leeds",
      deliveryPostcode: "LS1 5AR",
      deliveryPhone: "07700 900456",
    });
  });

  it("reprices for a new delivery choice and the old payment session can no longer pay", async () => {
    const { db, repo, recording, request, order, suffix } = await setup("replay-fulfilment");
    const first = await repo.createCheckoutOrder(request());
    const oldSession = requireDefined((await order(first.orderId)).stripeCheckoutSessionId, "s");
    expect((await order(first.orderId)).totalPence).toBe(9_500);

    const collect = await repo.createCheckoutOrder(withoutDelivery(request()));
    expect(collect.orderId).toBe(first.orderId);
    expect(recording.expired).toEqual([oldSession]);
    const updated = await order(first.orderId);
    expect(updated).toMatchObject({
      fulfilment: "collect_new_cavendish",
      fulfilmentSurchargePence: 0,
      totalPence: 8_000,
      deliveryLine1: null,
    });
    expect(updated.stripeCheckoutSessionId).not.toBe(oldSession);

    await expect(
      completeShopCheckoutSession(
        db,
        {
          eventId: `evt-old-${suffix}`,
          orderId: first.orderId,
          sessionId: oldSession,
          amountTotalPence: 9_500,
          paidAt: new Date(),
        },
        { domainEventMode: "off" },
      ),
    ).rejects.toThrow();
    expect((await order(first.orderId)).status).toBe("pending_payment");

    await completeShopCheckoutSession(
      db,
      {
        eventId: `evt-new-${suffix}`,
        orderId: first.orderId,
        sessionId: requireDefined(updated.stripeCheckoutSessionId, "new session"),
        amountTotalPence: 8_000,
        paidAt: new Date(),
      },
      { domainEventMode: "off" },
    );
    expect(await order(first.orderId)).toMatchObject({ status: "paid", totalPence: 8_000 });
  });
});
