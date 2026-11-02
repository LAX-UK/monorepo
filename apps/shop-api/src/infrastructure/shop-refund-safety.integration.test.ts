import type { Database } from "@auction/db";
import {
  shopAdminAudit,
  shopOrder,
  shopOrderLine,
  shopPayoutLedger,
  shopRefund,
} from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { and, eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {
  PaymentRefundGateway,
  SubmitRefundCommand,
  SubmitRefundResult,
} from "../application/ports/payment-refund.gateway.js";
import { ShopApiError } from "../errors/shop-api-error.js";
import {
  completeFixtureOrderPayment,
  createPendingPaymentOrderWithReservedEdition,
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
import { createDrizzleShopUnitOfWork } from "./drizzle-shop-transaction-effects.js";
import { createCancelAfterPossessionHandler } from "./handlers/admin/cancel-after-possession.handler.js";
import { createRequestRefundHandler } from "./handlers/admin/request-refund.handler.js";
import { createRetryRefundHandler } from "./handlers/admin/retry-refund.handler.js";
import { createSubmitPendingRefundsRunner } from "./scheduler/submit-pending-refunds.runner.js";

const ITEM_PENCE = 3_000;
const OTHER_ITEM_PENCE = 2_000;
const DELIVERY_PENCE = 1_000;
const ORDER_PENCE = ITEM_PENCE + OTHER_ITEM_PENCE + DELIVERY_PENCE;

describe.skipIf(!hasShopIntegrationDb)("shop refund safety integration", () => {
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

  /**
   * A paid order of two items and a delivery charge, inside its cancellation period, with the
   * first item's payout waiting to be paid.
   */
  async function paidTwoItemOrder(label: string) {
    const suffix = integrationSuffix(label);
    const imported = await importTestArtwork(db, label);
    await grantLaxSaleAuthority(db, imported.artworkId, 1);
    const pending = await createPendingPaymentOrderWithReservedEdition(db, {
      artworkId: imported.artworkId,
      suffix,
      totalPence: ITEM_PENCE,
    });
    await completeFixtureOrderPayment(db, pending, `evt-${suffix}`);
    const merchandise = await insertTestMerchandise(db, label);
    await db.insert(shopOrderLine).values({
      orderId: pending.orderId,
      productVariantId: merchandise.variantId,
      unitPricePence: OTHER_ITEM_PENCE,
    });
    await db
      .update(shopOrder)
      .set({
        totalPence: ORDER_PENCE,
        stripePaymentIntentId: `pi_${suffix}`,
        refundPeriodEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      .where(eq(shopOrder.id, pending.orderId));
    const [line] = await db
      .select({ id: shopOrderLine.id })
      .from(shopOrderLine)
      .where(
        and(
          eq(shopOrderLine.orderId, pending.orderId),
          eq(shopOrderLine.editionId, pending.editionId),
        ),
      );
    const orderLineId = requireDefined(line?.id, "order line");
    await db.insert(shopPayoutLedger).values({
      orderLineId,
      ownerPartyId: pending.sellerPartyId,
      grossPence: ITEM_PENCE,
      netPence: ITEM_PENCE,
      payoutDueAt: new Date(),
      status: "due",
      source: "order_line",
    });
    return { suffix, orderId: pending.orderId, editionId: pending.editionId, orderLineId };
  }

  const uow = () => createDrizzleShopUnitOfWork(db, "off");
  const actor = "finance-refund-safety-subject";

  async function cancelItem(order: Awaited<ReturnType<typeof paidTwoItemOrder>>) {
    const cancel = createCancelAfterPossessionHandler({ uow: uow() });
    const result = await cancel({
      orderLineId: order.orderLineId,
      editionId: order.editionId,
      actorSubjectId: actor,
      idempotencyKey: `cancel-${order.suffix}`,
    });
    return result.refundId;
  }

  async function refundRow(refundId: string) {
    const [row] = await db.select().from(shopRefund).where(eq(shopRefund.id, refundId));
    return requireDefined(row, "refund");
  }

  async function payoutBlock(orderLineId: string) {
    const [row] = await db
      .select({ blockedReason: shopPayoutLedger.blockedReason })
      .from(shopPayoutLedger)
      .where(eq(shopPayoutLedger.orderLineId, orderLineId));
    return row?.blockedReason ?? null;
  }

  /** A gateway that answers each refund as told and records what it was asked to send. */
  function gatewayAnswering(answers: Record<string, SubmitRefundResult>) {
    const calls: SubmitRefundCommand[] = [];
    const gateway: PaymentRefundGateway = {
      async submitRefund(command) {
        calls.push(command);
        return answers[command.refundId] ?? { ok: true, stripeRefundId: `re_${command.refundId}` };
      },
    };
    return { gateway, calls };
  }

  async function failTerminally(refundId: string) {
    const { gateway } = gatewayAnswering({
      [refundId]: { ok: false, retryable: false, message: "charge_already_refunded" },
    });
    await createSubmitPendingRefundsRunner(db, gateway)();
  }

  it("cancelling an item refunds it in full and holds the artist's payout", async () => {
    const order = await paidTwoItemOrder("cancel-holds");
    const refundId = await cancelItem(order);
    const refund = await refundRow(refundId);
    expect(refund).toMatchObject({
      amountPence: ITEM_PENCE,
      status: "pending",
      source: "cancellation",
      orderLineId: order.orderLineId,
    });
    expect(await payoutBlock(order.orderLineId)).toBe("cancellation");
  });

  it("a whole-order refund cannot take the money of a cancelled item whose refund failed", async () => {
    const order = await paidTwoItemOrder("whole-after-failed");
    const refundId = await cancelItem(order);
    await failTerminally(refundId);
    expect((await refundRow(refundId)).status).toBe("failed");

    const requestRefund = createRequestRefundHandler({ uow: uow() });
    // The order holds 60.00, 30.00 of it for the cancelled item: 30.00 is all the rest can take.
    const tooMuch = await requestRefund({
      orderId: order.orderId,
      amountPence: ORDER_PENCE - ITEM_PENCE + 1,
      actorSubjectId: actor,
      idempotencyKey: `whole-too-much-${order.suffix}`,
    }).catch((error: unknown) => error);
    expect(tooMuch).toBeInstanceOf(ShopApiError);
    expect((tooMuch as ShopApiError).code).toBe(SHOP_API_ERROR_CODES.VALIDATION);

    const rest = await requestRefund({
      orderId: order.orderId,
      amountPence: ORDER_PENCE - ITEM_PENCE,
      actorSubjectId: actor,
      idempotencyKey: `whole-rest-${order.suffix}`,
    });
    expect(rest.status).toBe("pending");
  });

  it("refunding a cancelled item again by line is refused while its refund is pending", async () => {
    const order = await paidTwoItemOrder("line-after-cancel");
    await cancelItem(order);
    const requestRefund = createRequestRefundHandler({ uow: uow() });
    const again = await requestRefund({
      orderId: order.orderId,
      orderLineId: order.orderLineId,
      amountPence: 100,
      actorSubjectId: actor,
      idempotencyKey: `line-again-${order.suffix}`,
    }).catch((error: unknown) => error);
    expect(again).toBeInstanceOf(ShopApiError);
    expect((again as ShopApiError).code).toBe(SHOP_API_ERROR_CODES.VALIDATION);
  });

  it("keeps the artist's payout held when a cancellation refund fails for good", async () => {
    const order = await paidTwoItemOrder("payout-held");
    const refundId = await cancelItem(order);
    await failTerminally(refundId);
    const refund = await refundRow(refundId);
    expect(refund.status).toBe("failed");
    expect(refund.lastError).toBe("charge_already_refunded");
    expect(await payoutBlock(order.orderLineId)).toBe("cancellation");
  });

  it("retries a failed refund once, with the same refund so Stripe cannot refund twice", async () => {
    const order = await paidTwoItemOrder("retry");
    const refundId = await cancelItem(order);
    await failTerminally(refundId);

    const retry = createRetryRefundHandler({ uow: uow() });
    const key = `retry-${order.suffix}`;
    const first = await retry({ refundId, actorSubjectId: actor, idempotencyKey: key });
    const replay = await retry({ refundId, actorSubjectId: actor, idempotencyKey: key });
    expect(first).toEqual({ refundId, status: "pending" });
    expect(replay).toEqual(first);

    const queued = await refundRow(refundId);
    expect(queued).toMatchObject({ status: "pending", submitAttempts: 0, lastError: null });
    expect(await payoutBlock(order.orderLineId)).toBe("cancellation");

    const audits = await db
      .select()
      .from(shopAdminAudit)
      .where(and(eq(shopAdminAudit.targetId, refundId), eq(shopAdminAudit.action, "retry_refund")));
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ actorSubjectId: actor, capability: "refund.write" });

    const { gateway, calls } = gatewayAnswering({});
    await createSubmitPendingRefundsRunner(db, gateway)();
    expect(calls.filter((call) => call.refundId === refundId)).toEqual([
      expect.objectContaining({ idempotencyKey: refundId, amountPence: ITEM_PENCE }),
    ]);
    expect((await refundRow(refundId)).stripeRefundId).toBe(`re_${refundId}`);
  });

  it("refuses to retry a refund that has not failed", async () => {
    const order = await paidTwoItemOrder("retry-pending");
    const refundId = await cancelItem(order);
    const retry = createRetryRefundHandler({ uow: uow() });
    const error = await retry({
      refundId,
      actorSubjectId: actor,
      idempotencyKey: `retry-pending-${order.suffix}`,
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ShopApiError);
    expect((error as ShopApiError).code).toBe(SHOP_API_ERROR_CODES.CONFLICT);
  });

  it("refuses to retry once another refund already covers the money", async () => {
    const order = await paidTwoItemOrder("retry-covered");
    const refundId = await cancelItem(order);
    await failTerminally(refundId);
    // Staff refunded the same item another way while the first one sat failed. Written directly
    // because the request path would (rightly) refuse it.
    await db.insert(shopRefund).values({
      orderId: order.orderId,
      orderLineId: order.orderLineId,
      amountPence: ITEM_PENCE,
      idempotencyKey: `manual-${order.suffix}`,
      requestedBySubjectId: actor,
      source: "admin",
    });
    const retry = createRetryRefundHandler({ uow: uow() });
    const error = await retry({
      refundId,
      actorSubjectId: actor,
      idempotencyKey: `retry-covered-${order.suffix}`,
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ShopApiError);
    expect((error as ShopApiError).code).toBe(SHOP_API_ERROR_CODES.CONFLICT);
    expect((await refundRow(refundId)).status).toBe("failed");
  });

  it("two staff retrying at once queue the refund once", async () => {
    const order = await paidTwoItemOrder("retry-race");
    const refundId = await cancelItem(order);
    await failTerminally(refundId);
    const retry = createRetryRefundHandler({ uow: uow() });
    const results = await Promise.allSettled([
      retry({ refundId, actorSubjectId: actor, idempotencyKey: `race-a-${order.suffix}` }),
      retry({ refundId, actorSubjectId: actor, idempotencyKey: `race-b-${order.suffix}` }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const audits = await db
      .select()
      .from(shopAdminAudit)
      .where(and(eq(shopAdminAudit.targetId, refundId), eq(shopAdminAudit.action, "retry_refund")));
    expect(audits).toHaveLength(1);
  });
});
