import type { Database } from "@auction/db";
import {
  shopBasketLine,
  shopEdition,
  shopFramingOption,
  shopFramingTask,
  shopFulfilment,
  shopOrder,
  shopOrderLine,
  shopPayoutLedger,
  shopRefund,
} from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import {
  type FramingOrderSnapshot,
  addWorkingDaysUtc,
  canTransitionProductionTask,
} from "@auction/shop-domain";
import { and, eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ShopApiError } from "../errors/shop-api-error.js";
import {
  completeFixtureOrderPayment,
  grantLaxSaleAuthority,
  importTestArtwork,
  integrationSuffix,
  requireDefined,
  selectLaxEdition,
} from "../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createDrizzleProductionTaskRepository } from "./drizzle-production-task.repository.js";
import { createDrizzleShopUnitOfWork } from "./drizzle-shop-transaction-effects.js";
import { createCancelAfterPossessionHandler } from "./handlers/admin/cancel-after-possession.handler.js";
import { createCreateProductionTaskHandler } from "./handlers/admin/create-production-task.handler.js";
import { createRequestRefundHandler } from "./handlers/admin/request-refund.handler.js";
import { createUpdateFramingTaskHandler } from "./handlers/admin/update-framing-task.handler.js";
import { createUpdateFulfilmentHandler } from "./handlers/admin/update-fulfilment.handler.js";
import { applyPayoutEffectsForRefund, recomputeOrderRefundStatus } from "./refund-settlement.js";
import { listArtistSalesForArtworkIds } from "./shop-artist-sales-query.js";
import { reserveEditionsForCheckoutOrder } from "./shop-checkout-reservation.js";
import { createShopDomainEventPublisher } from "./shop-domain-event-publisher.js";
import { restoreBasketLinesFromOrder } from "./shop-restore-basket-from-order.js";

const PRINT_PENCE = 30_000;
const FRAME_PENCE = 21_000;
const ORDER_PENCE = PRINT_PENCE + FRAME_PENCE;
const STANDARD_RATE_BP = 2000;

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

  async function framingOption(suffix: string) {
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
    return requireDefined(option?.id, "framing option");
  }

  function snapshotOf(optionId: string): FramingOrderSnapshot {
    return {
      optionId,
      name: "Natural oak frame",
      frame: "natural_oak",
      mount: "window_conservation",
      glazing: "uv_acrylic",
      hanging: "d_rings_cord",
      leadTimeMinDays: 10,
      leadTimeMaxDays: 15,
      pricePence: FRAME_PENCE,
    };
  }

  /**
   * A pending order of one print and the frame sold with it, built the way checkout builds it
   * (the shared reservation), then paid through the payment processor, which opens the task.
   */
  async function paidFramedOrder(label: string, options: { paid?: boolean } = {}) {
    const suffix = integrationSuffix(label);
    const imported = await importTestArtwork(db, label, { printPricePence: PRINT_PENCE });
    await grantLaxSaleAuthority(db, imported.artworkId, 1);
    const optionId = await framingOption(suffix);
    const edition = await selectLaxEdition(db, imported.artworkId);
    const stripeSessionId = `cs_test_${suffix}`;
    const [orderRow] = await db
      .insert(shopOrder)
      .values({
        identitySubjectId: `subject-${suffix}`,
        fulfilment: "collect_brunswick",
        merchandiseSubtotalPence: PRINT_PENCE,
        framingSubtotalPence: FRAME_PENCE,
        fulfilmentSurchargePence: 0,
        totalPence: ORDER_PENCE,
        idempotencyKey: `idem-${suffix}`,
        status: "pending_payment",
        stripeCheckoutSessionId: stripeSessionId,
        stripePaymentIntentId: `pi_${suffix}`,
      })
      .returning({ id: shopOrder.id });
    const orderId = requireDefined(orderRow?.id, "order id");
    await db.transaction(async (tx) => {
      await reserveEditionsForCheckoutOrder(
        tx as Database,
        {
          orderId,
          reservedUntil: new Date(Date.now() + 60 * 60 * 1000),
          expandedLines: [
            {
              artworkId: imported.artworkId,
              unitPricePence: PRINT_PENCE,
              framing: snapshotOf(optionId),
            },
          ],
          vatPolicy: { standardRateBp: STANDARD_RATE_BP },
        },
        createShopDomainEventPublisher("off"),
      );
    });
    const lines = await db.select().from(shopOrderLine).where(eq(shopOrderLine.orderId, orderId));
    const print = requireDefined(
      lines.find((line) => line.kind === "goods"),
      "print line",
    );
    const frame = requireDefined(
      lines.find((line) => line.kind === "framing"),
      "framing line",
    );
    if (options.paid !== false) {
      await completeFixtureOrderPayment(
        db,
        {
          orderId,
          editionId: edition.id,
          sellerPartyId: requireDefined(edition.ownerPartyId, "seller"),
          totalPence: ORDER_PENCE,
          identitySubjectId: `subject-${suffix}`,
          stripeSessionId,
        },
        `evt-${suffix}`,
      );
      // The cancellation period starts at possession; open it for the cancellation tests.
      await db
        .update(shopOrder)
        .set({ refundPeriodEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000) })
        .where(eq(shopOrder.id, orderId));
    }
    const [task] = await db
      .select()
      .from(shopFramingTask)
      .where(eq(shopFramingTask.orderLineId, frame.id));
    return {
      suffix,
      orderId,
      artworkId: imported.artworkId,
      editionId: edition.id,
      sellerPartyId: requireDefined(edition.ownerPartyId, "seller"),
      optionId,
      print,
      frame,
      task,
    };
  }

  async function taskOf(frameLineId: string) {
    const [task] = await db
      .select()
      .from(shopFramingTask)
      .where(eq(shopFramingTask.orderLineId, frameLineId));
    return requireDefined(task, "framing task");
  }

  async function payoutRows(printLineId: string) {
    return db.select().from(shopPayoutLedger).where(eq(shopPayoutLedger.orderLineId, printLineId));
  }

  async function giveTheArtistAPayout(order: Awaited<ReturnType<typeof paidFramedOrder>>) {
    await db.insert(shopPayoutLedger).values({
      orderLineId: order.print.id,
      ownerPartyId: order.sellerPartyId,
      grossPence: PRINT_PENCE,
      netPence: PRINT_PENCE,
      payoutDueAt: new Date(),
      status: "due",
      source: "order_line",
    });
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

  const requestRefund = () => createRequestRefundHandler({ uow: uow() });

  describe("what checkout and payment create", () => {
    it("reserves the print and its frame as two lines, the frame at the standard rate with no edition or seller", async () => {
      const order = await paidFramedOrder("reserve", { paid: false });
      expect(order.print.vatRateBp).toBe(STANDARD_RATE_BP);
      expect(order.frame).toMatchObject({
        kind: "framing",
        framingForLineId: order.print.id,
        framingOptionId: order.optionId,
        unitPricePence: FRAME_PENCE,
        vatTreatment: "standard",
        vatRateBp: STANDARD_RATE_BP,
        vatPence: 3500,
        editionId: null,
        artworkId: null,
        sellerPartyId: null,
      });
      expect(order.frame.framingSnapshot).toMatchObject({
        name: "Natural oak frame",
        pricePence: FRAME_PENCE,
      });
    });

    it("opens one task per frame when the order is paid, due after the longest lead time", async () => {
      const order = await paidFramedOrder("task");
      const task = requireDefined(order.task, "task opened by payment");
      expect(task.status).toBe("queued");
      const [paid] = await db.select().from(shopOrder).where(eq(shopOrder.id, order.orderId));
      const paidAt = requireDefined(paid?.paidAt, "paidAt");
      expect(task.dueAt.getTime()).toBe(addWorkingDaysUtc(paidAt, 15).getTime());
    });

    it("is not an artist sale and has no payout row", async () => {
      const order = await paidFramedOrder("not-a-sale");
      const sales = await listArtistSalesForArtworkIds(db, [order.artworkId], 50);
      expect(
        sales
          .filter((sale) => sale.channel === "shop_order")
          .map((sale) => [sale.saleId, sale.grossPence]),
      ).toEqual([[order.print.id, PRINT_PENCE]]);
      expect(await payoutRows(order.frame.id)).toEqual([]);
    });
  });

  describe("refunds", () => {
    it("refunding only the frame leaves the artist's payout alone and cancels its task", async () => {
      const order = await paidFramedOrder("frame-only");
      await giveTheArtistAPayout(order);
      const refund = await requestRefund()({
        orderId: order.orderId,
        orderLineId: order.frame.id,
        amountPence: FRAME_PENCE,
        actorSubjectId: actor,
        idempotencyKey: `refund-${order.suffix}`,
      });
      expect(refund.status).toBe("pending");
      expect((await taskOf(order.frame.id)).status).toBe("cancelled");
      await succeed(order.orderId, FRAME_PENCE, order.frame.id);
      expect(await payoutRows(order.print.id)).toMatchObject([
        { status: "due", blockedReason: null },
      ]);
    });

    it("refunding the print in full refunds its frame too, and cancels the task", async () => {
      const order = await paidFramedOrder("print-cascade");
      await giveTheArtistAPayout(order);
      await requestRefund()({
        orderId: order.orderId,
        orderLineId: order.print.id,
        amountPence: PRINT_PENCE,
        actorSubjectId: actor,
        idempotencyKey: `refund-${order.suffix}`,
      });
      const refunds = await db
        .select()
        .from(shopRefund)
        .where(eq(shopRefund.orderId, order.orderId));
      expect(refunds.map((refund) => [refund.orderLineId, refund.amountPence]).sort()).toEqual(
        [
          [order.print.id, PRINT_PENCE],
          [order.frame.id, FRAME_PENCE],
        ].sort(),
      );
      expect((await taskOf(order.frame.id)).status).toBe("cancelled");
    });

    it("refunding a part of the print does not take the frame", async () => {
      const order = await paidFramedOrder("print-part");
      await requestRefund()({
        orderId: order.orderId,
        orderLineId: order.print.id,
        amountPence: 1_000,
        actorSubjectId: actor,
        idempotencyKey: `refund-${order.suffix}`,
      });
      expect((await taskOf(order.frame.id)).status).toBe("queued");
      const refunds = await db
        .select()
        .from(shopRefund)
        .where(eq(shopRefund.orderId, order.orderId));
      expect(refunds).toHaveLength(1);
    });

    it("refunding the whole order cancels the task, even when the frame is being made", async () => {
      const order = await paidFramedOrder("whole-order");
      const task = requireDefined(order.task, "task");
      await createUpdateFramingTaskHandler({ uow: uow() })({
        taskId: task.id,
        status: "framing",
        expectedVersion: task.version,
        actorSubjectId: actor,
        idempotencyKey: `start-${order.suffix}`,
      });
      await requestRefund()({
        orderId: order.orderId,
        amountPence: ORDER_PENCE,
        actorSubjectId: actor,
        idempotencyKey: `refund-${order.suffix}`,
      });
      expect((await taskOf(order.frame.id)).status).toBe("cancelled");
    });

    it("refuses to refund a frame on its own once it is being made", async () => {
      const order = await paidFramedOrder("started");
      const task = requireDefined(order.task, "task");
      await createUpdateFramingTaskHandler({ uow: uow() })({
        taskId: task.id,
        status: "framing",
        expectedVersion: task.version,
        actorSubjectId: actor,
        idempotencyKey: `start-${order.suffix}`,
      });
      const refused = await requestRefund()({
        orderId: order.orderId,
        orderLineId: order.frame.id,
        amountPence: FRAME_PENCE,
        actorSubjectId: actor,
        idempotencyKey: `refund-${order.suffix}`,
      }).catch((error: unknown) => error);
      expect(refused).toBeInstanceOf(ShopApiError);
      expect((refused as ShopApiError).code).toBe(SHOP_API_ERROR_CODES.CONFLICT);
    });

    it("cancelling the print within the cancellation period refunds the frame with it", async () => {
      const order = await paidFramedOrder("cancel-cascade");
      await giveTheArtistAPayout(order);
      const result = await createCancelAfterPossessionHandler({ uow: uow() })({
        orderLineId: order.print.id,
        editionId: order.editionId,
        actorSubjectId: actor,
        idempotencyKey: `cancel-${order.suffix}`,
      });
      expect(result.framingRefundPence).toBe(FRAME_PENCE);
      const refunds = await db
        .select()
        .from(shopRefund)
        .where(eq(shopRefund.orderId, order.orderId));
      expect(refunds.map((refund) => refund.orderLineId).sort()).toEqual(
        [order.print.id, order.frame.id].sort(),
      );
      expect((await taskOf(order.frame.id)).status).toBe("cancelled");
    });

    it("shares an order-level refund over what each line has left, never crediting a refunded print twice", async () => {
      const order = await paidFramedOrder("no-double-credit");
      await giveTheArtistAPayout(order);
      // The print is refunded on its own, in full; then the rest of the order is refunded.
      await succeed(order.orderId, PRINT_PENCE, order.print.id);
      await succeed(order.orderId, FRAME_PENCE);
      const [row] = await db.select().from(shopOrder).where(eq(shopOrder.id, order.orderId));
      expect(row?.status).toBe("refunded");
      expect(await payoutRows(order.print.id)).toMatchObject([
        { status: "cancelled", blockedReason: "refund" },
      ]);
    });
  });

  describe("work on the frame", () => {
    it("moves one step at a time, and refuses a stale version or a skipped step", async () => {
      const order = await paidFramedOrder("steps");
      const task = requireDefined(order.task, "task");
      const update = createUpdateFramingTaskHandler({ uow: uow() });
      const step = (status: "framing" | "framed" | "completed", version: number, key: string) =>
        update({
          taskId: task.id,
          status,
          expectedVersion: version,
          actorSubjectId: actor,
          idempotencyKey: `${key}-${order.suffix}`,
        });
      const skipped = await step("completed", task.version, "skip").catch((e: unknown) => e);
      expect(skipped).toBeInstanceOf(ShopApiError);
      const started = await step("framing", task.version, "a");
      expect(started).toMatchObject({ status: "framing", version: task.version + 1 });
      const stale = await step("framed", task.version, "b").catch((e: unknown) => e);
      expect(stale).toBeInstanceOf(Error);
      expect((await step("framed", started.version, "c")).status).toBe("framed");
    });

    it("replays the same step with the same key without moving it twice", async () => {
      const order = await paidFramedOrder("replay");
      const task = requireDefined(order.task, "task");
      const update = createUpdateFramingTaskHandler({ uow: uow() });
      const command = {
        taskId: task.id,
        status: "framing" as const,
        expectedVersion: task.version,
        actorSubjectId: actor,
        idempotencyKey: `replay-${order.suffix}`,
      };
      const first = await update(command);
      const again = await update(command);
      expect(again).toEqual(first);
      expect((await taskOf(order.frame.id)).version).toBe(task.version + 1);
    });

    it("refuses to move work forward on a frame that has been refunded", async () => {
      const order = await paidFramedOrder("refunded-then-moved");
      const task = requireDefined(order.task, "task");
      await db.insert(shopRefund).values({
        orderId: order.orderId,
        orderLineId: order.frame.id,
        amountPence: FRAME_PENCE,
        status: "pending",
        idempotencyKey: `late-${order.suffix}`,
        source: "admin",
        requestedBySubjectId: actor,
      });
      const refused = await createUpdateFramingTaskHandler({ uow: uow() })({
        taskId: task.id,
        status: "framing",
        expectedVersion: task.version,
        actorSubjectId: actor,
        idempotencyKey: `start-${order.suffix}`,
      }).catch((error: unknown) => error);
      expect(refused).toBeInstanceOf(ShopApiError);
      expect((refused as ShopApiError).code).toBe(SHOP_API_ERROR_CODES.CONFLICT);
    });

    it("holds the order back from ready-to-dispatch until the frame is finished", async () => {
      const order = await paidFramedOrder("dispatch-gate");
      const task = requireDefined(order.task, "task");
      const [fulfilment] = await db
        .select({ id: shopFulfilment.id })
        .from(shopFulfilment)
        .where(eq(shopFulfilment.orderId, order.orderId));
      const fulfilmentId = requireDefined(fulfilment?.id, "fulfilment");
      const updateFulfilment = createUpdateFulfilmentHandler({
        uow: uow(),
        storefrontUrl: "http://localhost:3020",
      });
      await updateFulfilment({
        fulfilmentId,
        status: "in_production",
        actorSubjectId: actor,
        idempotencyKey: `prod-${order.suffix}`,
      });
      const refused = await updateFulfilment({
        fulfilmentId,
        status: "awaiting_dispatch",
        actorSubjectId: actor,
        idempotencyKey: `ready-${order.suffix}`,
      }).catch((error: unknown) => error);
      expect(refused).toBeInstanceOf(ShopApiError);
      expect((refused as ShopApiError).code).toBe(SHOP_API_ERROR_CODES.CONFLICT);

      const frameStep = createUpdateFramingTaskHandler({ uow: uow() });
      let version = task.version;
      for (const status of ["framing", "framed", "completed"] as const) {
        version = (
          await frameStep({
            taskId: task.id,
            status,
            expectedVersion: version,
            actorSubjectId: actor,
            idempotencyKey: `${status}-${order.suffix}`,
          })
        ).version;
      }
      const ready = await updateFulfilment({
        fulfilmentId,
        status: "awaiting_dispatch",
        actorSubjectId: actor,
        idempotencyKey: `ready2-${order.suffix}`,
      });
      expect(ready).toBeDefined();
    });

    it("does not let the print pass quality check while its frame is open", async () => {
      const order = await paidFramedOrder("qc-gate");
      const created = await createCreateProductionTaskHandler({ uow: uow() })({
        orderLineId: order.print.id,
        editionId: order.editionId,
        actorSubjectId: actor,
        idempotencyKey: `prodtask-${order.suffix}`,
      });
      const repo = createDrizzleProductionTaskRepository(db);
      let version = 1;
      const move = async (status: "printing" | "qc_pending" | "qc_passed") => {
        const outcome = await repo.update({
          id: created.taskId,
          expectedVersion: version,
          status,
          actorSubjectId: actor,
          canMove: canTransitionProductionTask,
        });
        if (outcome.status === "updated") version = outcome.version;
        return outcome;
      };
      await move("printing");
      await move("qc_pending");
      const refused = await move("qc_passed").catch((error: unknown) => error);
      expect(refused).toBeInstanceOf(ShopApiError);
      expect((refused as ShopApiError).code).toBe(SHOP_API_ERROR_CODES.CONFLICT);
    });
  });

  describe("the rows themselves", () => {
    it("keeps a framing line as it was sold: price, tax, snapshot, kind and deletion", async () => {
      const order = await paidFramedOrder("immutable");
      const attempts = [
        db
          .update(shopOrderLine)
          .set({ unitPricePence: 1 })
          .where(eq(shopOrderLine.id, order.frame.id)),
        db.update(shopOrderLine).set({ vatPence: 0 }).where(eq(shopOrderLine.id, order.frame.id)),
        db
          .update(shopOrderLine)
          .set({ framingSnapshot: { name: "Other" } })
          .where(eq(shopOrderLine.id, order.frame.id)),
        db.update(shopOrderLine).set({ kind: "goods" }).where(eq(shopOrderLine.id, order.frame.id)),
        db.delete(shopOrderLine).where(eq(shopOrderLine.id, order.frame.id)),
      ];
      for (const attempt of attempts) await expect(attempt).rejects.toThrow();
    });

    it("refuses a framing line with an edition or a seller, or one that points at a frame or another order", async () => {
      const order = await paidFramedOrder("constraints");
      const other = await paidFramedOrder("constraints-other");
      const base = {
        orderId: order.orderId,
        kind: "framing" as const,
        framingOptionId: order.optionId,
        framingSnapshot: snapshotOf(order.optionId),
        unitPricePence: FRAME_PENCE,
      };
      // With an edition and a seller (violates the target check).
      await expect(
        db.insert(shopOrderLine).values({
          ...base,
          framingForLineId: order.print.id,
          editionId: order.editionId,
          sellerPartyId: order.sellerPartyId,
        }),
      ).rejects.toThrow();
      // Pointing at a framing line, not a print.
      await expect(
        db.insert(shopOrderLine).values({ ...base, framingForLineId: order.frame.id }),
      ).rejects.toThrow();
      // Pointing at a print of another order.
      await expect(
        db.insert(shopOrderLine).values({ ...base, framingForLineId: other.print.id }),
      ).rejects.toThrow();
      // A second frame for the same print.
      await expect(
        db.insert(shopOrderLine).values({ ...base, framingForLineId: order.print.id }),
      ).rejects.toThrow();
    });
  });

  describe("a cancelled checkout", () => {
    it("puts the frame choice back on the print's basket line", async () => {
      const order = await paidFramedOrder("restore", { paid: false });
      // Release the reservation as the reaper does, so the print is on sale again.
      await db
        .update(shopOrderLine)
        .set({ releasedAt: new Date() })
        .where(eq(shopOrderLine.id, order.print.id));
      await db
        .update(shopEdition)
        .set({ listingStatus: "authorised", reservedUntil: null, reservedByOrderId: null })
        .where(eq(shopEdition.id, order.editionId));
      await restoreBasketLinesFromOrder(
        db,
        { identitySubjectId: `subject-${order.suffix}` },
        order.orderId,
        { kind: "subject", identitySubjectId: `subject-${order.suffix}` },
      );
      const restored = await db
        .select()
        .from(shopBasketLine)
        .where(
          and(
            eq(shopBasketLine.artworkId, order.artworkId),
            eq(shopBasketLine.framingOptionId, order.optionId),
          ),
        );
      expect(restored.length).toBeGreaterThanOrEqual(1);
    });
  });
});
