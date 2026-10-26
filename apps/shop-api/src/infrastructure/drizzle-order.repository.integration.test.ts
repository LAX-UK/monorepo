import { shopFulfilment, shopGeneralEnquiry, shopOrder, shopRefund } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  completeFixtureOrderPayment,
  createPendingPaymentOrderWithReservedEdition,
  grantLaxSaleAuthority,
  importTestArtwork,
  integrationSuffix,
} from "../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createDrizzleEditorialRepository } from "./drizzle-editorial.repository.js";
import { createDrizzleOrderProblemReportWriter } from "./drizzle-order-problem-report.writer.js";
import { createDrizzleOrderRepository } from "./drizzle-order.repository.js";
import { createDrizzleShopNotificationPublisher } from "./drizzle-shop-notification.publisher.js";
import { fulfilmentStageStamp } from "./fulfilment-stage-stamp.js";

describe.skipIf(!hasShopIntegrationDb)("drizzle order repository", () => {
  let ownerPool: pg.Pool;
  let shopPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await ownerPool.end();
    await shopPool.end();
  });

  async function paidOrder(label: string) {
    const db = createShopDb(shopPool);
    const artwork = await importTestArtwork(db, label, { printPricePence: 8_500 });
    await grantLaxSaleAuthority(db, artwork.artworkId, 1);
    const suffix = integrationSuffix(label);
    const fixture = await createPendingPaymentOrderWithReservedEdition(db, {
      artworkId: artwork.artworkId,
      suffix,
      totalPence: 8_500,
    });
    await completeFixtureOrderPayment(db, fixture, `evt_${suffix}`);
    return { db, fixture };
  }

  it("reads the reference, stage dates, refunds and the edition a paid order holds", async () => {
    const { db, fixture } = await paidOrder("order-read");
    const productionAt = new Date("2026-10-02T09:00:00.000Z");
    await db
      .update(shopFulfilment)
      .set({ status: "in_production", ...fulfilmentStageStamp("in_production", productionAt) })
      .where(eq(shopFulfilment.orderId, fixture.orderId));
    // Reaching the stage again keeps the first date.
    await db
      .update(shopFulfilment)
      .set(fulfilmentStageStamp("in_production", new Date("2026-10-09T09:00:00.000Z")))
      .where(eq(shopFulfilment.orderId, fixture.orderId));

    const repo = createDrizzleOrderRepository(db);
    const order = await repo.getOrder(fixture.identitySubjectId, fixture.orderId);
    expect(order?.reference).toMatch(/^LAX-S-\d{5,}$/);
    expect(order?.progress).toMatchObject({ status: "in_production" });
    expect(order?.progress?.productionStartedAt?.toISOString()).toBe(productionAt.toISOString());
    expect(order?.lines[0]?.editionNumber).toEqual(expect.any(Number));
    expect(order?.lines[0]?.editionSize).toEqual(expect.any(Number));
    expect(order?.lines[0]?.artistName).toBe("Integration Artist");

    await db.insert(shopRefund).values({
      orderId: fixture.orderId,
      amountPence: 8_500,
      status: "succeeded",
      idempotencyKey: `refund-${fixture.orderId}`,
      requestedBySubjectId: "integration-staff",
    });
    await db.update(shopOrder).set({ status: "refunded" }).where(eq(shopOrder.id, fixture.orderId));
    const refunded = await repo.getOrder(fixture.identitySubjectId, fixture.orderId);
    expect(refunded?.refundedPence).toBe(8_500);
    expect(refunded?.refunds).toEqual([
      expect.objectContaining({ amountPence: 8_500, status: "succeeded", source: "admin" }),
    ]);
    // A refunded order no longer holds the edition, so it names none.
    expect(refunded?.lines[0]?.editionNumber).toBeNull();
  });

  it("files a problem report in the staff inbox under the order reference", async () => {
    const { db, fixture } = await paidOrder("order-problem");
    const order = await createDrizzleOrderRepository(db).getOrder(
      fixture.identitySubjectId,
      fixture.orderId,
    );
    const queued: unknown[] = [];
    const writer = createDrizzleOrderProblemReportWriter(db, {
      notifications: {
        ...createDrizzleShopNotificationPublisher(),
        queueGeneralEnquiryAlert: async (_tx, input) => {
          queued.push(input);
        },
      },
      opsEmail: "ops@example.test",
    });
    const { reportId } = await writer.submit({
      sender: {
        kind: "account",
        identitySubjectId: fixture.identitySubjectId,
        contactName: null,
        contactEmail: null,
      },
      orderReference: order?.reference ?? "",
      reason: "damaged",
      details: "The corner is creased.",
    });
    const [row] = await db
      .select()
      .from(shopGeneralEnquiry)
      .where(eq(shopGeneralEnquiry.id, reportId));
    expect(row).toMatchObject({
      topic: "order_problem",
      contextSlug: order?.reference,
      message: "Arrived damaged\n\nThe corner is creased.",
      status: "new",
    });
    expect(queued).toEqual([
      expect.objectContaining({ topic: "order_problem", contextSlug: order?.reference }),
    ]);
    // It belongs to the order page, not the account's enquiry list.
    const listed = await createDrizzleEditorialRepository(db, {
      resolveMediaUrl: (value) => value ?? null,
    }).listGeneralEnquiriesForSubject(fixture.identitySubjectId);
    expect(listed.map((item) => item.enquiryId)).not.toContain(reportId);
  });

  it("names no edition on an order that was never paid", async () => {
    const db = createShopDb(shopPool);
    const artwork = await importTestArtwork(db, "order-unpaid");
    await grantLaxSaleAuthority(db, artwork.artworkId, 1);
    const fixture = await createPendingPaymentOrderWithReservedEdition(db, {
      artworkId: artwork.artworkId,
      suffix: integrationSuffix("order-unpaid"),
    });
    await db
      .update(shopOrder)
      .set({ status: "cancelled" })
      .where(eq(shopOrder.id, fixture.orderId));
    const order = await createDrizzleOrderRepository(db).getOrder(
      fixture.identitySubjectId,
      fixture.orderId,
    );
    expect(order?.status).toBe("cancelled");
    expect(order?.lines[0]?.editionNumber).toBeNull();
  });
});
