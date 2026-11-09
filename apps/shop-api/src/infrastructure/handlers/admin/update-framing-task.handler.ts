import { shopFramingTask, shopOrder, shopOrderLine, shopRefund } from "@auction/db/schema";
import { type FramingTask, SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import {
  type FramingTaskStatus,
  canMoveFramingTask,
  framingStageStamp,
} from "@auction/shop-domain";
import { and, eq, ne } from "drizzle-orm";
import { withAdminIdempotency } from "../../../application/admin/with-admin-idempotency.js";
import type { ShopUnitOfWorkFactory } from "../../../application/ports/shop-unit-of-work.js";
import { ShopApiError, notFound } from "../../../errors/shop-api-error.js";
import { StaleVersionError } from "../../../errors/stale-version-error.js";
import { shopPhaseDbSession } from "../../drizzle-shop-transaction-effects.js";

export type UpdateFramingTaskCommand = {
  taskId: string;
  status: FramingTaskStatus;
  expectedVersion: number;
  actorSubjectId: string;
  idempotencyKey: string;
};

const REFUNDABLE_ORDER_STATUSES = ["paid", "partially_refunded"];

/**
 * Moves the work on a frame to its next step. Each step is audited; a change made from an older
 * version is refused, and a step that skips or goes back is refused by the domain. Work only moves
 * forward while the order is paid and the frame has not been refunded: the order and the frame's
 * line are locked and read here, so a refund that lands at the same moment is seen, not raced.
 */
export function createUpdateFramingTaskHandler(deps: { uow: ShopUnitOfWorkFactory }) {
  return async (command: UpdateFramingTaskCommand): Promise<FramingTask> =>
    deps.uow.run(async (tx) =>
      withAdminIdempotency({
        tx,
        commandType: "framing_task.update",
        idempotencyKey: command.idempotencyKey,
        actorSubjectId: command.actorSubjectId,
        requestPayload: command,
        run: async () => {
          const db = shopPhaseDbSession(tx);
          const [task] = await db
            .select()
            .from(shopFramingTask)
            .where(eq(shopFramingTask.id, command.taskId))
            .for("update")
            .limit(1);
          if (!task) throw notFound("Framing task");
          if (task.version !== command.expectedVersion) {
            throw new StaleVersionError("This framing task", String(task.version));
          }
          const from = task.status as FramingTaskStatus;
          if (!canMoveFramingTask(from, command.status)) {
            throw new ShopApiError(
              SHOP_API_ERROR_CODES.CONFLICT,
              `Framing cannot go from ${from} to ${command.status}`,
              409,
            );
          }
          if (command.status !== "cancelled") {
            await assertFrameStillSold(db, task.orderLineId);
          }
          const now = new Date();
          const [updated] = await db
            .update(shopFramingTask)
            .set({
              status: command.status,
              ...framingStageStamp(command.status, now),
              version: task.version + 1,
              updatedAt: now,
            })
            .where(eq(shopFramingTask.id, task.id))
            .returning();
          if (!updated) {
            throw new ShopApiError(SHOP_API_ERROR_CODES.INTERNAL, "Failed to update framing", 500);
          }
          await tx.audit.append({
            actorSubjectId: command.actorSubjectId,
            capability: "production.write",
            action: "update_framing_task",
            targetType: "shop_framing_task",
            targetId: task.id,
            beforeJson: { status: from },
            afterJson: { status: command.status },
          });
          return {
            taskId: updated.id,
            orderLineId: updated.orderLineId,
            status: updated.status as FramingTaskStatus,
            dueAt: updated.dueAt.toISOString(),
            version: updated.version,
          };
        },
      }),
    );
}

/** The order is paid and nothing has been refunded (or is waiting to be) on the frame's line. */
async function assertFrameStillSold(
  db: ReturnType<typeof shopPhaseDbSession>,
  frameLineId: string,
): Promise<void> {
  const [line] = await db
    .select({
      orderId: shopOrderLine.orderId,
      unitPricePence: shopOrderLine.unitPricePence,
    })
    .from(shopOrderLine)
    .where(eq(shopOrderLine.id, frameLineId))
    .for("update")
    .limit(1);
  if (!line) throw notFound("Order line");
  const [order] = await db
    .select({ status: shopOrder.status })
    .from(shopOrder)
    .where(eq(shopOrder.id, line.orderId))
    .for("update")
    .limit(1);
  if (!order || !REFUNDABLE_ORDER_STATUSES.includes(order.status)) {
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.CONFLICT,
      "This order is not paid, so the frame is not made",
      409,
    );
  }
  const refunds = await db
    .select({ amountPence: shopRefund.amountPence })
    .from(shopRefund)
    .where(
      and(
        eq(shopRefund.orderLineId, frameLineId),
        ne(shopRefund.status, "failed"),
        ne(shopRefund.status, "cancelled"),
      ),
    );
  const refunded = refunds.reduce((sum, refund) => sum + refund.amountPence, 0);
  if (refunded >= line.unitPricePence && line.unitPricePence > 0) {
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.CONFLICT,
      "This frame has been refunded, so it is not made",
      409,
    );
  }
}
