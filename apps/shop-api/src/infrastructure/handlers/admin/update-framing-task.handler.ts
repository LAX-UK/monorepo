import { shopFramingTask } from "@auction/db/schema";
import { type FramingTask, SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { type FramingTaskStatus, canMoveFramingTask } from "@auction/shop-domain";
import { eq } from "drizzle-orm";
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

/** The column that records when a step began, for the steps that have one. */
function stageStamp(status: FramingTaskStatus, now: Date) {
  switch (status) {
    case "framing":
      return { framingStartedAt: now };
    case "framed":
      return { framedAt: now };
    case "completed":
      return { completedAt: now };
    default:
      return {};
  }
}

/**
 * Moves the work on a frame to its next step. Each step is audited; a change made
 * from an older version is refused, and a step that skips or goes back is refused by the domain.
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
          const now = new Date();
          const [updated] = await db
            .update(shopFramingTask)
            .set({
              status: command.status,
              ...stageStamp(command.status, now),
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
