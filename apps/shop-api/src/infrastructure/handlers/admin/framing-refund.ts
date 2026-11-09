import { shopFramingTask, shopOrderLine, shopRefund } from "@auction/db/schema";
import {
  framingTaskFinished,
  parseFramingTaskStatus,
  remainingRefundablePence,
} from "@auction/shop-domain";
import { and, eq, inArray } from "drizzle-orm";
import type { ShopTransactionEffects } from "../../../application/ports/shop-unit-of-work.js";
import { shopPhaseDbSession } from "../../drizzle-shop-transaction-effects.js";
import { loadOrderRefunds } from "./load-order-refunds.js";

/*
 * What a refund does to the work on a frame. A frame that is refunded, or whose print is
 * refunded or cancelled, or whose order is refunded in full, is not made: its task is cancelled
 * in the same transaction as the refund, so the order is never held up waiting for a frame that
 * is no longer wanted.
 *
 * A refund of the whole order, or of a print, is a decision about the sale, not about the unused
 * item: it takes the frame with it even when the frame is being made. Only a frame refunded on
 * its own is held back once framing starts (see `framingRefundBlock`).
 */

type Db = ReturnType<typeof shopPhaseDbSession>;

/** Cancels each open framing task among `taskRows`, one version up, with an audit entry. */
async function cancelTasks(
  tx: ShopTransactionEffects,
  actorSubjectId: string,
  reason: string,
  taskRows: ReadonlyArray<{ id: string; status: string; version: number }>,
): Promise<void> {
  const db = shopPhaseDbSession(tx);
  for (const task of taskRows) {
    const from = parseFramingTaskStatus(task.status);
    if (framingTaskFinished(from)) continue;
    await db
      .update(shopFramingTask)
      .set({ status: "cancelled", version: task.version + 1, updatedAt: new Date() })
      .where(eq(shopFramingTask.id, task.id));
    await tx.audit.append({
      actorSubjectId,
      capability: "refund.write",
      action: "cancel_framing_task",
      targetType: "shop_framing_task",
      targetId: task.id,
      beforeJson: { status: from },
      afterJson: { status: "cancelled", reason },
    });
  }
}

/** Locks and cancels the framing tasks of the given framing lines. */
export async function cancelFramingTasksForLines(
  tx: ShopTransactionEffects,
  input: { frameLineIds: readonly string[]; actorSubjectId: string; reason: string },
): Promise<void> {
  if (input.frameLineIds.length === 0) return;
  const tasks = await shopPhaseDbSession(tx)
    .select({
      id: shopFramingTask.id,
      status: shopFramingTask.status,
      version: shopFramingTask.version,
    })
    .from(shopFramingTask)
    .where(inArray(shopFramingTask.orderLineId, [...input.frameLineIds]))
    .for("update");
  await cancelTasks(tx, input.actorSubjectId, input.reason, tasks);
}

/** Every framing line of an order. */
export async function framingLineIdsOfOrder(db: Db, orderId: string): Promise<string[]> {
  const rows = await db
    .select({ id: shopOrderLine.id })
    .from(shopOrderLine)
    .where(and(eq(shopOrderLine.orderId, orderId), eq(shopOrderLine.kind, "framing")));
  return rows.map((row) => row.id);
}

export type FramingRefundCascade = { refundId: string; amountPence: number } | null;

/**
 * Refunds the frame sold with a print, for what is left of it, and cancels its task. Called when
 * the print itself is refunded in full or cancelled. Returns null when the print has no frame or
 * the frame has already been refunded.
 */
export async function refundFrameWithPrint(
  tx: ShopTransactionEffects,
  input: {
    orderId: string;
    orderTotalPence: number;
    printLineId: string;
    source: "admin" | "cancellation";
    idempotencyKey: string;
    actorSubjectId: string;
  },
): Promise<FramingRefundCascade> {
  const db = shopPhaseDbSession(tx);
  const [frame] = await db
    .select({ id: shopOrderLine.id, unitPricePence: shopOrderLine.unitPricePence })
    .from(shopOrderLine)
    .where(
      and(eq(shopOrderLine.framingForLineId, input.printLineId), eq(shopOrderLine.kind, "framing")),
    )
    .for("update")
    .limit(1);
  if (!frame) return null;
  await cancelFramingTasksForLines(tx, {
    frameLineIds: [frame.id],
    actorSubjectId: input.actorSubjectId,
    reason: "print_refunded",
  });
  const refunds = await loadOrderRefunds(db, input.orderId);
  const remaining = remainingRefundablePence({
    orderTotalPence: input.orderTotalPence,
    lineTotalPence: frame.unitPricePence,
    refunds,
    orderLineId: frame.id,
  });
  if (remaining <= 0) return null;
  const [refund] = await db
    .insert(shopRefund)
    .values({
      orderId: input.orderId,
      orderLineId: frame.id,
      amountPence: remaining,
      idempotencyKey: `${input.idempotencyKey}:framing`,
      requestedBySubjectId: input.actorSubjectId,
      source: input.source,
    })
    .returning({ id: shopRefund.id });
  if (!refund) throw new Error("Failed to record the frame's refund");
  return { refundId: refund.id, amountPence: remaining };
}
