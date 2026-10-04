import {
  domainEvent,
  emailOutbox,
  shopEdition,
  shopOrder,
  shopOrderLine,
  shopSaleAuthorityGrant,
} from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { and, eq, sql } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ShopApiError } from "../errors/shop-api-error.js";
import {
  completeFixtureOrderPayment,
  createPendingPaymentOrderWithReservedEdition,
  grantLaxSaleAuthority,
  importTestArtwork,
  insertExpiredOpenBasket,
  integrationSuffix,
  requireDefined,
  selectLaxEdition,
} from "../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createDrizzleArtworkImportRepository } from "./drizzle-artwork-import.repository.js";
import {
  completeShopCheckoutSession,
  recordShopCheckoutCurrencyViolation,
} from "./drizzle-payment-event.processor.js";
import { createDrizzleSaleAuthorityWriter } from "./drizzle-sale-authority.writer.js";
import { createDrizzleShopNotificationPublisher } from "./drizzle-shop-notification.publisher.js";
import { seedShopFoundationCatalogue } from "./seed/catalogue-seed.js";
import { ensureOpenBasket } from "./shop-basket.persistence.js";
import { reserveEditionsForCheckoutOrder } from "./shop-checkout-reservation.js";
import { createShopDomainEventPublisher } from "./shop-domain-event-publisher.js";
import {
  parseCheckoutSessionCompleted,
  parseShopCheckoutCurrencyViolation,
} from "./stripe-webhook.dto.js";

describe.skipIf(!hasShopIntegrationDb)("shop v1 phase 1 invariants", () => {
  let shopPool!: pg.Pool;
  let ownerPool!: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await Promise.allSettled([ownerPool.end(), shopPool.end()]);
  });

  it("does not sell the same edition twice", async () => {
    const db = createShopDb(shopPool);
    const events = createShopDomainEventPublisher("off");
    const suffix = integrationSuffix("double-sell");
    const imported = await importTestArtwork(db, "double-sell");
    await grantLaxSaleAuthority(db, imported.artworkId, 1);
    const unitPricePence = 5_000;
    const reservedUntil = new Date(Date.now() + 60 * 60 * 1000);

    const [orderA] = await db
      .insert(shopOrder)
      .values({
        identitySubjectId: `subject-${suffix}-a`,
        fulfilment: "collect_brunswick",
        merchandiseSubtotalPence: unitPricePence,
        fulfilmentSurchargePence: 0,
        totalPence: unitPricePence,
        idempotencyKey: `idem-${suffix}-a`,
        status: "pending_payment",
      })
      .returning({ id: shopOrder.id });
    const [orderB] = await db
      .insert(shopOrder)
      .values({
        identitySubjectId: `subject-${suffix}-b`,
        fulfilment: "collect_brunswick",
        merchandiseSubtotalPence: unitPricePence,
        fulfilmentSurchargePence: 0,
        totalPence: unitPricePence,
        idempotencyKey: `idem-${suffix}-b`,
        status: "pending_payment",
      })
      .returning({ id: shopOrder.id });
    const orderAId = requireDefined(orderA?.id, "order A");
    const orderBId = requireDefined(orderB?.id, "order B");

    const reserveLine = { artworkId: imported.artworkId, unitPricePence };
    const outcomes = await Promise.allSettled([
      db.transaction((tx) =>
        reserveEditionsForCheckoutOrder(
          tx,
          { orderId: orderAId, reservedUntil, expandedLines: [reserveLine] },
          events,
        ),
      ),
      db.transaction((tx) =>
        reserveEditionsForCheckoutOrder(
          tx,
          { orderId: orderBId, reservedUntil, expandedLines: [reserveLine] },
          events,
        ),
      ),
    ]);

    const fulfilled = outcomes.filter((o) => o.status === "fulfilled");
    const rejected = outcomes.filter((o) => o.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const rejection = rejected[0];
    expect(rejection?.status).toBe("rejected");
    if (rejection?.status === "rejected") {
      expect(rejection.reason).toBeInstanceOf(ShopApiError);
      expect((rejection.reason as ShopApiError).code).toBe(SHOP_API_ERROR_CODES.OUT_OF_STOCK);
    }

    const activeLines = await db
      .select({ orderId: shopOrderLine.orderId, editionId: shopOrderLine.editionId })
      .from(shopOrderLine)
      .where(
        and(
          eq(shopOrderLine.artworkId, imported.artworkId),
          sql`${shopOrderLine.releasedAt} is null`,
        ),
      );
    expect(activeLines).toHaveLength(1);
  });

  it("emits shop.edition.sold for LAX-owned lines on payment", async () => {
    const db = createShopDb(shopPool);
    const suffix = integrationSuffix("lax-sold-event");
    const imported = await importTestArtwork(db, "lax-sold-event");
    await grantLaxSaleAuthority(db, imported.artworkId, 1);
    const pending = await createPendingPaymentOrderWithReservedEdition(db, {
      artworkId: imported.artworkId,
      suffix,
    });
    await completeFixtureOrderPayment(db, pending, `evt-${suffix}`);

    const soldEvents = await db
      .select({ payload: domainEvent.payload })
      .from(domainEvent)
      .where(eq(domainEvent.eventType, "shop.edition.sold"));
    const soldForEdition = soldEvents.some(
      (row) =>
        typeof row.payload === "object" &&
        row.payload !== null &&
        "editionId" in row.payload &&
        row.payload.editionId === pending.editionId,
    );
    expect(soldForEdition).toBe(true);
  });

  it("retires an expired open basket and opens a fresh one", async () => {
    const db = createShopDb(shopPool);
    const subjectId = integrationSuffix("basket-expiry-subject");
    const expiredId = await insertExpiredOpenBasket(db, {
      kind: "subject",
      identitySubjectId: subjectId,
    });
    const newBasketId = await ensureOpenBasket(db, {
      kind: "subject",
      identitySubjectId: subjectId,
    });
    expect(newBasketId).not.toBe(expiredId);
  });

  it("acknowledges paid webhook when order is already expired without mutating state", async () => {
    const db = createShopDb(shopPool);
    const suffix = integrationSuffix("terminal-paid");
    const imported = await importTestArtwork(db, "terminal-paid");
    await grantLaxSaleAuthority(db, imported.artworkId, 1);
    const pending = await createPendingPaymentOrderWithReservedEdition(db, {
      artworkId: imported.artworkId,
      suffix,
    });
    await db.update(shopOrder).set({ status: "expired" }).where(eq(shopOrder.id, pending.orderId));

    const notifications = createDrizzleShopNotificationPublisher();
    const outcome = await completeShopCheckoutSession(
      db,
      {
        eventId: `evt-${suffix}`,
        orderId: pending.orderId,
        sessionId: pending.stripeSessionId,
        amountTotalPence: pending.totalPence,
        paidAt: new Date(),
      },
      { domainEventMode: "off", notifications, opsAlertEmail: "ops@example.com" },
    );
    expect(outcome).toBe("terminal_acknowledged");
    const [order] = await db
      .select({ status: shopOrder.status })
      .from(shopOrder)
      .where(eq(shopOrder.id, pending.orderId))
      .limit(1);
    expect(order?.status).toBe("expired");

    const opsAlerts = await db
      .select({ template: emailOutbox.template })
      .from(emailOutbox)
      .where(eq(emailOutbox.idempotencyKey, `terminal-paid:evt-${suffix}`));
    expect(opsAlerts).toHaveLength(1);
    expect(opsAlerts[0]?.template).toBe("shop-checkout-ops-alert");
  });

  it("rejects non-GBP paid checkout sessions for shop metadata", () => {
    const parsed = parseCheckoutSessionCompleted({
      id: "evt_currency",
      type: "checkout.session.completed",
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: "cs_test",
          payment_status: "paid",
          currency: "usd",
          amount_total: 5000,
          metadata: { app: "shop", orderId: "00000000-0000-4000-8000-000000000001" },
        },
      },
    } as never);
    expect(parsed).toBeNull();
    const violation = parseShopCheckoutCurrencyViolation({
      id: "evt_currency",
      type: "checkout.session.completed",
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: "cs_test",
          payment_status: "paid",
          currency: "usd",
          amount_total: 5000,
          metadata: { app: "shop", orderId: "00000000-0000-4000-8000-000000000001" },
        },
      },
    } as never);
    expect(violation?.currency).toBe("usd");
  });

  it("records non-GBP violations in email outbox without rejecting Stripe retries", async () => {
    const db = createShopDb(shopPool);
    const suffix = integrationSuffix("currency-outbox");
    const notifications = createDrizzleShopNotificationPublisher();
    await recordShopCheckoutCurrencyViolation(
      db,
      {
        eventId: `evt-${suffix}`,
        orderId: "00000000-0000-4000-8000-000000000099",
        currency: "usd",
        sessionId: `cs_test_${suffix}`,
      },
      { notifications, opsAlertEmail: "ops@example.com" },
    );
    const rows = await db
      .select({ template: emailOutbox.template })
      .from(emailOutbox)
      .where(eq(emailOutbox.idempotencyKey, `currency-violation:evt-${suffix}`));
    expect(rows).toHaveLength(1);
  });

  it("allows reducing free authorised count to zero while sold editions stay sold", async () => {
    const db = createShopDb(shopPool);
    const imported = await importTestArtwork(db, "authority-floor");
    const lax = await selectLaxEdition(db, imported.artworkId);
    const ownerPartyId = requireDefined(lax.ownerPartyId, "owner");
    const authorityWriter = createDrizzleSaleAuthorityWriter(db, "off");
    await authorityWriter.grantSaleAuthority({
      artworkId: imported.artworkId,
      ownerPartyId,
      authorisedCount: 2,
      evidenceNote: "grant two",
      recordedBySubjectId: "staff-floor",
    });
    await db.update(shopEdition).set({ listingStatus: "sold" }).where(eq(shopEdition.id, lax.id));
    const result = await authorityWriter.grantSaleAuthority({
      artworkId: imported.artworkId,
      ownerPartyId,
      authorisedCount: 0,
      evidenceNote: "revoke free",
      recordedBySubjectId: "staff-floor",
    });
    expect(result.editionNumbersRevoked.length).toBeGreaterThan(0);
  });

  it("seed catalogue can be re-run after a simulated sale", async () => {
    const db = createShopDb(shopPool);
    const importWriter = createDrizzleArtworkImportRepository(db, "off");
    const authorityWriter = createDrizzleSaleAuthorityWriter(db, "off");
    const grantSaleAuthority = authorityWriter.grantSaleAuthority.bind(authorityWriter);
    await seedShopFoundationCatalogue(
      importWriter.importArtwork.bind(importWriter),
      db,
      grantSaleAuthority,
    );
    const grantsBefore = await db
      .select({ id: shopSaleAuthorityGrant.id })
      .from(shopSaleAuthorityGrant);
    const [soldEdition] = await db.select({ id: shopEdition.id }).from(shopEdition).limit(1);
    if (soldEdition) {
      await db
        .update(shopEdition)
        .set({ listingStatus: "sold" })
        .where(eq(shopEdition.id, soldEdition.id));
    }
    await seedShopFoundationCatalogue(
      importWriter.importArtwork.bind(importWriter),
      db,
      grantSaleAuthority,
    );
    const grantsAfter = await db
      .select({ id: shopSaleAuthorityGrant.id })
      .from(shopSaleAuthorityGrant);
    expect(grantsAfter.length).toBe(grantsBefore.length);
  });
});
