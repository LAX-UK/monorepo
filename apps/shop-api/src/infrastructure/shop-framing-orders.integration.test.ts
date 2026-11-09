import type { Database } from "@auction/db";
import {
  shopFramingOption,
  shopFramingTask,
  shopOrder,
  shopOrderLine,
  shopPayoutLedger,
  shopRefund,
} from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { and, eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ShopApiError } from "../errors/shop-api-error.js";
import {
  completeFixtureOrderPayment,
  createPendingPaymentOrderWithReservedEdition,
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
import { createDrizzleShopUnitOfWork } from "./drizzle-shop-transaction-effects.js";
import { createRequestRefundHandler } from "./handlers/admin/request-refund.handler.js";
import { createUpdateFramingTaskHandler } from "./handlers/admin/update-framing-task.handler.js";
import { applyPayoutEffectsForRefund, recomputeOrderRefundStatus } from "./refund-settlement.js";
import { listArtistSalesForArtworkIds } from "./shop-artist-sales-query.js";

const PRINT_PENCE = 30_000;
const FRAME_PENCE = 21_000;
const ORDER_PENCE = PRINT_PENCE + FRAME_PENCE;

describe.skipIf(!hasShopIntegrationDb)("framing in orders integration", () => {
  let shopPool!: pg.Pool;
  let ownerPool!: pg.Pool;
  let db!: Database;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
    db = createShopDb(shopPool);
  });

  afterAll(async () => {
    await Promise.allSettled([ownerPool.end(), shopPool.end()]);
  });

  const uow = () => createDrizzleShopUnitOfWork(db, "off");
  const actor = "framing-orders-subject";

  /** A paid order of one print and the frame sold with it, with the print's payout waiting. */
  async function paidFramedOrder(label: string) {
    const suffix = integrationSuffix(label);
    const imported = await importTestArtwork(db, label);
    await grantLaxSaleAuthority(db, imported.artworkId, 1);
    const pending = await createPendingPaymentOrderWithReservedEdition(db, {
      artworkId: imported.artworkId,
      suffix,
      totalPence: PRINT_PENCE,
    });
    const [option] = await db
      .insert(shopFramingOption)
      .values({
        code: `oak-${suffix}`,
        name: "Natural oak frame",
        frame: "natural_oak",
        mount: "window_conservation",
        glazing: "uv_acrylic",
        hanging: "d_rings_cord",
        leadTimeMinDays: 10,
        leadTimeMaxDays: 15,
        status: "active",
      })
      .returning({ id: shopFramingOption.id });
    const optionId = requireDefined(option?.id, "framing option");
    const [print] = await db
      .select({ id: shopOrderLine.id })
      .from(shopOrderLine)
      .where(eq(shopOrderLine.orderId, pending.orderId));
    const printLineId = requireDefined(print?.id, "print line");
    const [frame] = await db
      .insert(shopOrderLine)
      .values({
        orderId: pending.orderId,
        kind: "framing",
        framingForLineId: printLineId,
        framingOptionId: optionId,
        framingSnapshot: { optionId, name: "Natural oak frame", pricePence: FRAME_PENCE },
        unitPricePence: FRAME_PENCE,
      })
      .returning({ id: shopOrderLine.id });
    const frameLineId = requireDefined(frame?.id, "framing line");
    await db
      .update(shopOrder)
      .set({
        framingSubtotalPence: FRAME_PENCE,
        totalPence: ORDER_PENCE,
        stripePaymentIntentId: `pi_${suffix}`,
        refundPeriodEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      .where(eq(shopOrder.id, pending.orderId));
    await completeFixtureOrderPayment(db, pending, `evt-${suffix}`);
    await db.insert(shopPayoutLedger).values({
      orderLineId: printLineId,
      ownerPartyId: pending.sellerPartyId,
      grossPence: PRINT_PENCE,
      netPence: PRINT_PENCE,
      payoutDueAt: new Date(),
      status: "due",
      source: "order_line",
    });
    const [task] = await db
      .insert(shopFramingTask)
      .values({ orderLineId: frameLineId, dueAt: new Date(Date.now() + 86_400_000) })
      .returning({ id: shopFramingTask.id, version: shopFramingTask.version });
    return {
      suffix,
      orderId: pending.orderId,
      artworkId: imported.artworkId,
      printLineId,
      frameLineId,
      taskId: requireDefined(task?.id, "framing task"),
      taskVersion: requireDefined(task?.version, "task version"),
    };
  }

  async function succeed(orderId: string, amountPence: number, orderLineId?: string) {
    await db.insert(shopRefund).values({
      orderId,
      amountPence,
      status: "succeeded",
      idempotencyKey: `r-${orderId}-${amountPence}-${orderLineId ?? "order"}`,
      source: "admin",
      requestedBySubjectId: actor,
      ...(orderLineId ? { orderLineId } : {}),
    });
    const { succeededTotal } = await recomputeOrderRefundStatus(db, orderId, ORDER_PENCE);
    await applyPayoutEffectsForRefund(db, orderId, ORDER_PENCE, succeededTotal);
  }

  async function payoutOf(orderLineId: string) {
    const [row] = await db
      .select({ status: shopPayoutLedger.status, blockedReason: shopPayoutLedger.blockedReason })
      .from(shopPayoutLedger)
      .where(eq(shopPayoutLedger.orderLineId, orderLineId));
    return row ?? null;
  }

  it("is not an artist sale and has no payout row", async () => {
    const order = await paidFramedOrder("not-a-sale");
    const sales = await listArtistSalesForArtworkIds(db, [order.artworkId], 50);
    const orderSales = sales.filter((sale) => sale.channel === "shop_order");
    expect(orderSales.map((sale) => [sale.saleId, sale.grossPence])).toEqual([
      [order.printLineId, PRINT_PENCE],
    ]);
    expect(await payoutOf(order.frameLineId)).toBeNull();
  });

  it("refunding only the frame leaves the artist's payout alone", async () => {
    const order = await paidFramedOrder("frame-only");
    await succeed(order.orderId, FRAME_PENCE, order.frameLineId);
    expect(await payoutOf(order.printLineId)).toEqual({ status: "due", blockedReason: null });
  });

  it("refunding the print in full cancels its payout, and the frame needs its own refund", async () => {
    const order = await paidFramedOrder("print-only");
    await succeed(order.orderId, PRINT_PENCE, order.printLineId);
    expect(await payoutOf(order.printLineId)).toMatchObject({
      status: "cancelled",
      blockedReason: "refund",
    });
    const [frame] = await db
      .select({ id: shopRefund.id })
      .from(shopRefund)
      .where(
        and(eq(shopRefund.orderId, order.orderId), eq(shopRefund.orderLineId, order.frameLineId)),
      );
    expect(frame).toBeUndefined();
  });

  it("gives the frame its share of a part refund of the whole order, without touching the payout of a fully paid print", async () => {
    const order = await paidFramedOrder("pro-rata");
    // 10% of the order: the print's share is 10% of its price, so the payout is only reviewed.
    await succeed(order.orderId, ORDER_PENCE / 10);
    expect(await payoutOf(order.printLineId)).toEqual({
      status: "due",
      blockedReason: "refund_review",
    });
    expect(await payoutOf(order.frameLineId)).toBeNull();
  });

  it("refuses to refund a frame as unused once it is being made", async () => {
    const order = await paidFramedOrder("started");
    const update = createUpdateFramingTaskHandler({ uow: uow() });
    await update({
      taskId: order.taskId,
      status: "framing",
      expectedVersion: order.taskVersion,
      actorSubjectId: actor,
      idempotencyKey: `start-${order.suffix}`,
    });
    const refused = await createRequestRefundHandler({ uow: uow() })({
      orderId: order.orderId,
      orderLineId: order.frameLineId,
      amountPence: FRAME_PENCE,
      actorSubjectId: actor,
      idempotencyKey: `refund-${order.suffix}`,
    }).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(ShopApiError);
    expect((refused as ShopApiError).code).toBe(SHOP_API_ERROR_CODES.CONFLICT);
  });

  it("refunds a frame that has not been started", async () => {
    const order = await paidFramedOrder("not-started");
    const refund = await createRequestRefundHandler({ uow: uow() })({
      orderId: order.orderId,
      orderLineId: order.frameLineId,
      amountPence: FRAME_PENCE,
      actorSubjectId: actor,
      idempotencyKey: `refund-${order.suffix}`,
    });
    expect(refund.status).toBe("pending");
  });

  it("moves a frame one step at a time and refuses a stale version or a skipped step", async () => {
    const order = await paidFramedOrder("steps");
    const update = createUpdateFramingTaskHandler({ uow: uow() });
    const step = (status: "framing" | "framed" | "completed", version: number, key: string) =>
      update({
        taskId: order.taskId,
        status,
        expectedVersion: version,
        actorSubjectId: actor,
        idempotencyKey: `${key}-${order.suffix}`,
      });
    const skipped = await step("completed", order.taskVersion, "skip").catch((e: unknown) => e);
    expect(skipped).toBeInstanceOf(ShopApiError);
    const started = await step("framing", order.taskVersion, "a");
    expect(started).toMatchObject({ status: "framing", version: order.taskVersion + 1 });
    const stale = await step("framed", order.taskVersion, "b").catch((e: unknown) => e);
    expect(stale).toBeInstanceOf(Error);
    const framed = await step("framed", started.version, "c");
    expect(framed.status).toBe("framed");
  });

  it("keeps a framing line as it was sold", async () => {
    const order = await paidFramedOrder("immutable");
    await expect(
      db
        .update(shopOrderLine)
        .set({ unitPricePence: 1 })
        .where(eq(shopOrderLine.id, order.frameLineId)),
    ).rejects.toThrow();
  });
});
