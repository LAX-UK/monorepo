import { shopEdition, shopOrder, shopOrderLine, shopProductionTask } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { and, eq } from "drizzle-orm";
import { operatorContextAuditFields } from "../../../application/admin/operator-context.js";
import { withAdminIdempotency } from "../../../application/admin/with-admin-idempotency.js";
import type { ShopUnitOfWorkFactory } from "../../../application/ports/shop-unit-of-work.js";
import { ShopApiError, notFound } from "../../../errors/shop-api-error.js";
import { isPgUniqueViolation } from "../../../lib/pg-errors.js";
import { shopPhaseDbSession } from "../../drizzle-shop-transaction-effects.js";

export type CreateProductionTaskCommand = {
  orderLineId: string;
  editionId: string;
  actorSubjectId: string;
  idempotencyKey: string;
  operatorContext?: import("../../../application/admin/operator-context.js").ShopOperatorContext;
};

export type CreateProductionTaskResult = { taskId: string; status: "queued" };

export function createCreateProductionTaskHandler(deps: {
  uow: ShopUnitOfWorkFactory;
}): (command: CreateProductionTaskCommand) => Promise<CreateProductionTaskResult> {
  return async (command) =>
    deps.uow.run(async (tx) =>
      withAdminIdempotency({
        tx,
        commandType: "production.create_task",
        idempotencyKey: command.idempotencyKey,
        actorSubjectId: command.actorSubjectId,
        requestPayload: command,
        run: async () => {
          const [line] = await shopPhaseDbSession(tx)
            .select({
              id: shopOrderLine.id,
              editionId: shopOrderLine.editionId,
              orderId: shopOrderLine.orderId,
            })
            .from(shopOrderLine)
            .where(eq(shopOrderLine.id, command.orderLineId))
            .for("update")
            .limit(1);
          if (!line) {
            throw notFound("Order line");
          }
          if (line.editionId !== command.editionId) {
            throw new ShopApiError(
              SHOP_API_ERROR_CODES.VALIDATION,
              "Edition does not belong to order line",
              400,
            );
          }
          const [order] = await shopPhaseDbSession(tx)
            .select({ status: shopOrder.status, paidAt: shopOrder.paidAt })
            .from(shopOrder)
            .where(eq(shopOrder.id, line.orderId))
            .limit(1);
          if (!order || order.status !== "paid" || !order.paidAt) {
            throw new ShopApiError(
              SHOP_API_ERROR_CODES.CONFLICT,
              "Order line is not from a paid order",
              409,
            );
          }
          const [edition] = await shopPhaseDbSession(tx)
            .select({ id: shopEdition.id })
            .from(shopEdition)
            .where(and(eq(shopEdition.id, command.editionId), eq(shopEdition.id, line.editionId)))
            .limit(1);
          if (!edition) {
            throw notFound("Edition");
          }
          let result: CreateProductionTaskResult;
          let createdNew = true;
          try {
            const [task] = await shopPhaseDbSession(tx)
              .insert(shopProductionTask)
              .values({
                orderLineId: command.orderLineId,
                editionId: command.editionId,
                status: "queued",
                assignedToSubjectId: command.actorSubjectId,
              })
              .returning({ id: shopProductionTask.id });
            if (!task) {
              throw new Error("Failed to create production task");
            }
            result = { taskId: task.id, status: "queued" };
          } catch (err) {
            if (isPgUniqueViolation(err)) {
              const [existing] = await shopPhaseDbSession(tx)
                .select({ id: shopProductionTask.id })
                .from(shopProductionTask)
                .where(eq(shopProductionTask.orderLineId, command.orderLineId))
                .limit(1);
              if (!existing) {
                throw err;
              }
              result = { taskId: existing.id, status: "queued" };
              createdNew = false;
            } else {
              throw err;
            }
          }

          if (!createdNew) {
            return result;
          }

          await tx.audit.append({
            actorSubjectId: command.actorSubjectId,
            capability: "production.write",
            action: "create_production_task",
            targetType: "shop_production_task",
            targetId: result.taskId,
            afterJson: {
              orderLineId: command.orderLineId,
              editionId: command.editionId,
              ...operatorContextAuditFields(command.operatorContext),
            },
          });
          await tx.events.append({
            aggregateType: "shop_production_task",
            aggregateId: result.taskId,
            eventType: "shop.production.started",
            payload: {
              schemaVersion: 1,
              taskId: result.taskId,
              orderLineId: command.orderLineId,
              editionId: command.editionId,
            },
          });
          return result;
        },
      }),
    );
}
