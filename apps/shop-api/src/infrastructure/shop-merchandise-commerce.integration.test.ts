import { shopFulfilment, shopOrder, shopProductVariant } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  grantLaxSaleAuthority,
  importTestArtwork,
  insertTestMerchandise,
  integrationSuffix,
  requireDefined,
} from "../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createDrizzleBasketRepository } from "./drizzle-basket.repository.js";
import {
  completeShopCheckoutSession,
  expireShopCheckoutSession,
} from "./drizzle-payment-event.processor.js";
import {
  reserveEditionsForCheckoutOrder,
  reserveProductVariantsForCheckoutOrder,
} from "./shop-checkout-reservation.js";
import { createShopDomainEventPublisher } from "./shop-domain-event-publisher.js";

describe.skipIf(!hasShopIntegrationDb)("shop merchandise commerce", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await ownerPool.end();
    await shopPool.end();
  });

  it("keeps artwork and variant lines in a mixed basket", async () => {
    const db = createShopDb(shopPool);
    const imported = await importTestArtwork(db, "mixed-basket");
    await grantLaxSaleAuthority(db, imported.artworkId, 2);
    const merch = await insertTestMerchandise(db, "mixed-basket");
    const repo = createDrizzleBasketRepository(db, { merchandiseEnabled: true });
    const owner = {
      kind: "subject" as const,
      identitySubjectId: `integration-subject-mixed-${integrationSuffix("mixed")}`,
    };

    await repo.addOrUpdateLine({ owner, artworkSlug: imported.slug, quantity: 1 });
    const basket = await repo.addOrUpdateLine({
      owner,
      productVariantId: merch.variantId,
      quantity: 2,
    });

    expect(basket.lines).toHaveLength(2);
    expect(basket.lines.some((line) => line.artworkSlug === imported.slug)).toBe(true);
    expect(basket.lines.some((line) => line.productVariantId === merch.variantId)).toBe(true);
  });

  it("reserves variant stock at checkout and releases it when checkout expires", async () => {
    const db = createShopDb(shopPool);
    const suffix = integrationSuffix("variant-expire");
    const merch = await insertTestMerchandise(db, "variant-expire", { onHand: 5 });
    const unitPricePence = merch.pricePence;
    const [orderRow] = await db
      .insert(shopOrder)
      .values({
        identitySubjectId: `subject-${suffix}`,
        fulfilment: "collect_brunswick",
        merchandiseSubtotalPence: unitPricePence,
        fulfilmentSurchargePence: 0,
        totalPence: unitPricePence,
        idempotencyKey: `idem-${suffix}`,
        status: "pending_payment",
        stripeCheckoutSessionId: `cs_test_${suffix}`,
      })
      .returning({ id: shopOrder.id });
    const orderId = requireDefined(orderRow?.id, "order id");

    await db.transaction((tx) =>
      reserveProductVariantsForCheckoutOrder(tx, {
        orderId,
        expandedLines: [{ productVariantId: merch.variantId, unitPricePence }],
      }),
    );

    const [reservedRow] = await db
      .select({ reserved: shopProductVariant.reserved })
      .from(shopProductVariant)
      .where(eq(shopProductVariant.id, merch.variantId));
    expect(reservedRow?.reserved).toBe(1);

    await expireShopCheckoutSession(
      db,
      { eventId: `expire-${suffix}`, orderId, sessionId: `cs_test_${suffix}` },
      { domainEventMode: "off" },
    );

    const [releasedRow] = await db
      .select({ reserved: shopProductVariant.reserved, onHand: shopProductVariant.onHand })
      .from(shopProductVariant)
      .where(eq(shopProductVariant.id, merch.variantId));
    expect(releasedRow?.reserved).toBe(0);
    expect(releasedRow?.onHand).toBe(5);
  });

  it("marks merch-only paid orders awaiting dispatch and decrements on-hand stock", async () => {
    const db = createShopDb(shopPool);
    const suffix = integrationSuffix("variant-paid");
    const merch = await insertTestMerchandise(db, "variant-paid", { onHand: 4 });
    const unitPricePence = merch.pricePence;
    const [orderRow] = await db
      .insert(shopOrder)
      .values({
        identitySubjectId: `subject-${suffix}`,
        fulfilment: "collect_brunswick",
        merchandiseSubtotalPence: unitPricePence,
        fulfilmentSurchargePence: 0,
        totalPence: unitPricePence,
        idempotencyKey: `idem-${suffix}`,
        status: "pending_payment",
        stripeCheckoutSessionId: `cs_test_${suffix}`,
      })
      .returning({ id: shopOrder.id });
    const orderId = requireDefined(orderRow?.id, "order id");

    await db.transaction((tx) =>
      reserveProductVariantsForCheckoutOrder(tx, {
        orderId,
        expandedLines: [{ productVariantId: merch.variantId, unitPricePence }],
      }),
    );

    await completeShopCheckoutSession(
      db,
      {
        eventId: `paid-${suffix}`,
        orderId,
        sessionId: `cs_test_${suffix}`,
        amountTotalPence: unitPricePence,
        paidAt: new Date(),
      },
      { domainEventMode: "off" },
    );

    const [fulfilment] = await db
      .select({ status: shopFulfilment.status })
      .from(shopFulfilment)
      .where(eq(shopFulfilment.orderId, orderId));
    expect(fulfilment?.status).toBe("awaiting_dispatch");

    const [stock] = await db
      .select({ onHand: shopProductVariant.onHand, reserved: shopProductVariant.reserved })
      .from(shopProductVariant)
      .where(eq(shopProductVariant.id, merch.variantId));
    expect(stock?.onHand).toBe(3);
    expect(stock?.reserved).toBe(0);
  });

  it("still reserves editions independently for mixed checkout orders", async () => {
    const db = createShopDb(shopPool);
    const events = createShopDomainEventPublisher("off");
    const suffix = integrationSuffix("mixed-reserve");
    const imported = await importTestArtwork(db, "mixed-reserve");
    await grantLaxSaleAuthority(db, imported.artworkId, 1);
    const merch = await insertTestMerchandise(db, "mixed-reserve");
    const [orderRow] = await db
      .insert(shopOrder)
      .values({
        identitySubjectId: `subject-${suffix}`,
        fulfilment: "collect_brunswick",
        merchandiseSubtotalPence: 5_000 + merch.pricePence,
        fulfilmentSurchargePence: 0,
        totalPence: 5_000 + merch.pricePence,
        idempotencyKey: `idem-${suffix}`,
        status: "pending_payment",
      })
      .returning({ id: shopOrder.id });
    const orderId = requireDefined(orderRow?.id, "order id");
    const reservedUntil = new Date(Date.now() + 60 * 60 * 1000);

    await db.transaction(async (tx) => {
      await reserveProductVariantsForCheckoutOrder(tx, {
        orderId,
        expandedLines: [{ productVariantId: merch.variantId, unitPricePence: merch.pricePence }],
      });
      await reserveEditionsForCheckoutOrder(
        tx,
        {
          orderId,
          reservedUntil,
          expandedLines: [{ artworkId: imported.artworkId, unitPricePence: 5_000 }],
        },
        events,
      );
    });

    const [fulfilment] = await db
      .select({ status: shopFulfilment.status })
      .from(shopFulfilment)
      .where(eq(shopFulfilment.orderId, orderId));
    expect(fulfilment).toBeUndefined();
  });

  it("creates pending_production fulfilment when a mixed order is paid", async () => {
    const db = createShopDb(shopPool);
    const suffix = integrationSuffix("mixed-paid");
    const imported = await importTestArtwork(db, "mixed-paid");
    await grantLaxSaleAuthority(db, imported.artworkId, 1);
    const merch = await insertTestMerchandise(db, "mixed-paid");
    const editionPrice = 5_000;
    const totalPence = editionPrice + merch.pricePence;
    const [orderRow] = await db
      .insert(shopOrder)
      .values({
        identitySubjectId: `subject-${suffix}`,
        fulfilment: "collect_brunswick",
        merchandiseSubtotalPence: totalPence,
        fulfilmentSurchargePence: 0,
        totalPence,
        idempotencyKey: `idem-${suffix}`,
        status: "pending_payment",
        stripeCheckoutSessionId: `cs_test_${suffix}`,
      })
      .returning({ id: shopOrder.id });
    const orderId = requireDefined(orderRow?.id, "order id");
    const reservedUntil = new Date(Date.now() + 60 * 60 * 1000);

    await db.transaction(async (tx) => {
      await reserveProductVariantsForCheckoutOrder(tx, {
        orderId,
        expandedLines: [{ productVariantId: merch.variantId, unitPricePence: merch.pricePence }],
      });
      await reserveEditionsForCheckoutOrder(
        tx,
        {
          orderId,
          reservedUntil,
          expandedLines: [{ artworkId: imported.artworkId, unitPricePence: editionPrice }],
        },
        createShopDomainEventPublisher("off"),
      );
    });

    await completeShopCheckoutSession(
      db,
      {
        eventId: `paid-mixed-${suffix}`,
        orderId,
        sessionId: `cs_test_${suffix}`,
        amountTotalPence: totalPence,
        paidAt: new Date(),
      },
      { domainEventMode: "off" },
    );

    const [fulfilment] = await db
      .select({ status: shopFulfilment.status })
      .from(shopFulfilment)
      .where(eq(shopFulfilment.orderId, orderId));
    expect(fulfilment?.status).toBe("pending_production");
  });

  it("does not double-decrement variant stock when checkout completion webhook is replayed", async () => {
    const db = createShopDb(shopPool);
    const suffix = integrationSuffix("webhook-replay");
    const merch = await insertTestMerchandise(db, "webhook-replay", { onHand: 3 });
    const unitPricePence = merch.pricePence;
    const [orderRow] = await db
      .insert(shopOrder)
      .values({
        identitySubjectId: `subject-${suffix}`,
        fulfilment: "collect_brunswick",
        merchandiseSubtotalPence: unitPricePence,
        fulfilmentSurchargePence: 0,
        totalPence: unitPricePence,
        idempotencyKey: `idem-${suffix}`,
        status: "pending_payment",
        stripeCheckoutSessionId: `cs_test_${suffix}`,
      })
      .returning({ id: shopOrder.id });
    const orderId = requireDefined(orderRow?.id, "order id");

    await db.transaction((tx) =>
      reserveProductVariantsForCheckoutOrder(tx, {
        orderId,
        expandedLines: [{ productVariantId: merch.variantId, unitPricePence }],
      }),
    );

    const payload = {
      eventId: `paid-replay-${suffix}`,
      orderId,
      sessionId: `cs_test_${suffix}`,
      amountTotalPence: unitPricePence,
      paidAt: new Date(),
    };
    const first = await completeShopCheckoutSession(db, payload, { domainEventMode: "off" });
    const second = await completeShopCheckoutSession(db, payload, { domainEventMode: "off" });
    expect(first).toBe("processed");
    expect(second).toBe("duplicate");

    const [stock] = await db
      .select({ onHand: shopProductVariant.onHand, reserved: shopProductVariant.reserved })
      .from(shopProductVariant)
      .where(eq(shopProductVariant.id, merch.variantId));
    expect(stock?.onHand).toBe(2);
    expect(stock?.reserved).toBe(0);
  });
});
