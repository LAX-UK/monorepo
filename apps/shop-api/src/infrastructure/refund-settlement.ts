import type { Database } from "@auction/db";
import {
  shopFramingTask,
  shopOrder,
  shopOrderLine,
  shopPayoutLedger,
  shopRefund,
} from "@auction/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";

/*
 * What a refund that has really reached the customer does to the order and the artist's payout.
 * Shared by the payment provider's webhook and by finance confirming a refund made elsewhere, so
 * the two can never disagree. A refund never changes the edition's stock: only a returned item
 * going back on sale does that.
 */

/**
 * Splits order-level succeeded refunds across lines by weight, in proportion to each line's
 * `unitPricePence` (last line with a weight gets the rounding remainder). A line with no weight
 * takes no share.
 */
export function allocateOrderLevelRefundsToLines(
  orderLevelSucceededPence: number,
  lines: Array<{ id: string; unitPricePence: number }>,
): Map<string, number> {
  const allocated = new Map<string, number>();
  if (orderLevelSucceededPence <= 0 || lines.length === 0) {
    return allocated;
  }
  const weighted = lines.filter((line) => line.unitPricePence > 0);
  const orderTotal = weighted.reduce((sum, line) => sum + line.unitPricePence, 0);
  if (orderTotal <= 0) {
    return allocated;
  }
  let assigned = 0;
  for (let index = 0; index < weighted.length; index++) {
    const line = weighted[index];
    if (!line) continue;
    const share =
      index === weighted.length - 1
        ? orderLevelSucceededPence - assigned
        : Math.floor((orderLevelSucceededPence * line.unitPricePence) / orderTotal);
    allocated.set(line.id, share);
    assigned += share;
  }
  return allocated;
}

export function computeEffectiveLineRefundedPence(
  lines: Array<{ id: string; unitPricePence: number }>,
  succeededRefunds: Array<{ amountPence: number; orderLineId: string | null }>,
): Map<string, number> {
  const directByLine = new Map<string, number>();
  let orderLevelSucceeded = 0;
  for (const row of succeededRefunds) {
    if (row.orderLineId) {
      directByLine.set(row.orderLineId, (directByLine.get(row.orderLineId) ?? 0) + row.amountPence);
    } else {
      orderLevelSucceeded += row.amountPence;
    }
  }
  // An order-level refund is shared over what each line has left, so a line already refunded on
  // its own (a print and its frame refunded together, say) is never credited a second time.
  const orderLevelShare = allocateOrderLevelRefundsToLines(
    orderLevelSucceeded,
    lines.map((line) => ({
      id: line.id,
      unitPricePence: Math.max(0, line.unitPricePence - (directByLine.get(line.id) ?? 0)),
    })),
  );
  const effective = new Map<string, number>();
  for (const line of lines) {
    effective.set(line.id, (directByLine.get(line.id) ?? 0) + (orderLevelShare.get(line.id) ?? 0));
  }
  return effective;
}

function deriveOrderRefundStatus(
  orderTotalPence: number,
  succeededRefundTotal: number,
): "paid" | "partially_refunded" | "refunded" {
  if (succeededRefundTotal <= 0) return "paid";
  if (succeededRefundTotal >= orderTotalPence) return "refunded";
  return "partially_refunded";
}

export async function recomputeOrderRefundStatus(
  tx: Database,
  orderId: string,
  orderTotalPence: number,
) {
  const refundRows = await tx
    .select({ amountPence: shopRefund.amountPence, status: shopRefund.status })
    .from(shopRefund)
    .where(eq(shopRefund.orderId, orderId));
  const succeededTotal = refundRows
    .filter((row) => row.status === "succeeded")
    .reduce((sum, row) => sum + row.amountPence, 0);
  const nextStatus = deriveOrderRefundStatus(orderTotalPence, succeededTotal);
  await tx.update(shopOrder).set({ status: nextStatus }).where(eq(shopOrder.id, orderId));
  return { nextStatus, succeededTotal };
}

export async function applyPayoutEffectsForRefund(
  tx: Database,
  orderId: string,
  orderTotalPence: number,
  succeededTotal: number,
): Promise<void> {
  const lines = await tx
    .select({
      id: shopOrderLine.id,
      unitPricePence: shopOrderLine.unitPricePence,
      kind: shopOrderLine.kind,
    })
    .from(shopOrderLine)
    .where(eq(shopOrderLine.orderId, orderId));
  if (lines.length === 0) return;

  const refundRows = await tx
    .select({
      amountPence: shopRefund.amountPence,
      orderLineId: shopRefund.orderLineId,
    })
    .from(shopRefund)
    .where(and(eq(shopRefund.orderId, orderId), eq(shopRefund.status, "succeeded")));

  const effectiveByLine = computeEffectiveLineRefundedPence(lines, refundRows);
  const orderFullyRefunded = succeededTotal >= orderTotalPence;

  // A frame that has been refunded in full, alone or with its order, is not made. Refunds made
  // through LAX already cancel the task when they are requested; this covers one the payment
  // provider reports from outside.
  const refundedFrameLineIds = lines
    .filter(
      (line) =>
        line.kind === "framing" &&
        (orderFullyRefunded || (effectiveByLine.get(line.id) ?? 0) >= line.unitPricePence),
    )
    .map((line) => line.id);
  if (refundedFrameLineIds.length > 0) {
    await tx
      .update(shopFramingTask)
      .set({
        status: "cancelled",
        version: sql`${shopFramingTask.version} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          inArray(shopFramingTask.orderLineId, refundedFrameLineIds),
          inArray(shopFramingTask.status, ["queued", "framing", "framed"]),
        ),
      );
  }

  for (const line of lines) {
    const lineRefunded = effectiveByLine.get(line.id) ?? 0;
    const lineFullyRefunded = orderFullyRefunded || lineRefunded >= line.unitPricePence;

    const payouts = await tx
      .select({ id: shopPayoutLedger.id, status: shopPayoutLedger.status })
      .from(shopPayoutLedger)
      .where(eq(shopPayoutLedger.orderLineId, line.id));

    for (const payout of payouts) {
      if (payout.status === "paid") {
        if (lineFullyRefunded || orderFullyRefunded) {
          await tx
            .update(shopPayoutLedger)
            .set({ blockedReason: "clawback" })
            .where(eq(shopPayoutLedger.id, payout.id));
        }
        continue;
      }
      if (lineFullyRefunded || orderFullyRefunded) {
        await tx
          .update(shopPayoutLedger)
          .set({ status: "cancelled", blockedReason: "refund" })
          .where(
            and(
              eq(shopPayoutLedger.id, payout.id),
              inArray(shopPayoutLedger.status, ["pending_refund_period", "due"]),
            ),
          );
      } else if (lineRefunded > 0) {
        await tx
          .update(shopPayoutLedger)
          .set({ blockedReason: "refund_review" })
          .where(
            and(
              eq(shopPayoutLedger.id, payout.id),
              inArray(shopPayoutLedger.status, ["pending_refund_period", "due"]),
            ),
          );
      }
    }
  }
}
