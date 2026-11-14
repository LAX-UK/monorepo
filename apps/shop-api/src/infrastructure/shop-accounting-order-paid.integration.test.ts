import { domainEvent, shopOrder, shopOrderLine } from "@auction/db/schema";
import { DrizzleUnappliedMoneyReader } from "@auction/persistence/repositories";
import { and, eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
import { completeShopCheckoutSession } from "./drizzle-payment-event.processor.js";

function gateway(): PaymentCheckoutGateway {
  let n = 0;
  return {
    async createHostedCheckout(input) {
      n += 1;
      const sessionId = `cs_test_${input.orderId}_${n}`;
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
}

describe.skipIf(!hasShopIntegrationDb)("Shop order paid, for the books (outbox)", () => {
  let ownerPool!: pg.Pool;
  let shopPool!: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await Promise.allSettled([ownerPool.end(), shopPool.end()]);
  });

  /** A UK order for one print, ready to pay. Fixture data only. */
  async function pendingOrder(label: string) {
    const db = createShopDb(shopPool);
    const suffix = integrationSuffix(label);
    const imported = await importTestArtwork(db, label, { printPricePence: 8_000 });
    await grantLaxSaleAuthority(db, imported.artworkId, 1);
    const repo = createDrizzleCommerceRepository(db, gateway(), {
      storefrontUrl: "http://localhost:3020",
      domainEventMode: "off",
      vatPolicy: { standardRateBp: 2000 },
    });
    const subject = `subject-${suffix}`;
    const basket = await repo.addOrUpdateLine({
      owner: { kind: "subject", identitySubjectId: subject },
      artworkSlug: imported.slug,
      quantity: 1,
    });
    const created = await repo.createCheckoutOrder({
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
    const order = async () =>
      requireDefined(
        (await db.select().from(shopOrder).where(eq(shopOrder.id, created.orderId)))[0],
        "order",
      );
    const events = () =>
      db
        .select()
        .from(domainEvent)
        .where(
          and(
            eq(domainEvent.aggregateId, created.orderId),
            eq(domainEvent.eventType, "shop.accounting.order_paid"),
          ),
        );
    return { db, suffix, order, events };
  }

  it("is written with the payment, once, naming the order and its lines only", async () => {
    const { db, suffix, order, events } = await pendingOrder("books-paid");
    const pending = await order();
    expect(await events()).toEqual([]);
    const paidAt = new Date("2031-11-12T14:05:00.000Z");
    const pay = (eventId: string) =>
      completeShopCheckoutSession(
        db,
        {
          eventId,
          orderId: pending.id,
          sessionId: requireDefined(pending.stripeCheckoutSessionId, "session"),
          amountTotalPence: pending.totalPence,
          paidAt,
        },
        // Enforce: the payload is checked against the catalogue's contract before it is written.
        { domainEventMode: "enforce" },
      );
    expect(await pay(`evt-${suffix}`)).toBe("processed");

    const paid = await order();
    expect(paid.status).toBe("paid");
    expect(paid.invoiceNumber).toMatch(/^LAX-INV-\d{6,}$/);
    const lineIds = (
      await db
        .select({ id: shopOrderLine.id })
        .from(shopOrderLine)
        .where(eq(shopOrderLine.orderId, pending.id))
    )
      .map((l) => l.id)
      .sort();
    const [event, ...rest] = await events();
    expect(rest).toEqual([]);
    expect(event?.producer).toBe("shop-api");
    expect(event?.aggregateType).toBe("shop_order");
    // References only: no names, emails, addresses or amounts.
    expect(event?.payload).toEqual({
      schemaVersion: 1,
      orderId: pending.id,
      lineIds,
      paidAt: paidAt.toISOString(),
    });

    // The same Stripe event again, or another event for the same payment: still one.
    expect(await pay(`evt-${suffix}`)).toBe("duplicate");
    expect(await pay(`evt-again-${suffix}`)).toBe("processed");
    expect(await events()).toHaveLength(1);
  });

  it("is not written when the payment cannot be applied (the transaction rolls back)", async () => {
    const { db, suffix, order, events } = await pendingOrder("books-unapplied");
    const pending = await order();
    const outcome = await completeShopCheckoutSession(
      db,
      {
        eventId: `evt-wrong-${suffix}`,
        orderId: pending.id,
        sessionId: requireDefined(pending.stripeCheckoutSessionId, "session"),
        amountTotalPence: pending.totalPence + 1,
        paidAt: new Date(),
        paymentIntentId: `pi_${suffix}`,
      },
      { domainEventMode: "enforce", unappliedMoney: new DrizzleUnappliedMoneyReader(db) },
    );
    expect(outcome).toBe("unapplied_recorded");
    expect((await order()).invoiceNumber).toBeNull();
    expect(await events()).toEqual([]);
  });
});
