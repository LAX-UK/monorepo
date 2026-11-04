import {
  shopArtwork,
  shopEdition,
  shopOrder,
  shopOrderLine,
  shopProductionTask,
} from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { editionDisplayLabel } from "@auction/shop-domain";
import { and, eq } from "drizzle-orm";
import { operatorContextAuditFields } from "../../../application/admin/operator-context.js";
import { withAdminIdempotency } from "../../../application/admin/with-admin-idempotency.js";
import type { ShopUnitOfWorkFactory } from "../../../application/ports/shop-unit-of-work.js";
import { ShopApiError, notFound } from "../../../errors/shop-api-error.js";
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
            .select({
              status: shopOrder.status,
              paidAt: shopOrder.paidAt,
              reference: shopOrder.reference,
              identitySubjectId: shopOrder.identitySubjectId,
            })
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
            .select({
              id: shopEdition.id,
              artworkId: shopEdition.artworkId,
              editionNumber: shopEdition.editionNumber,
              proofNumber: shopEdition.proofNumber,
            })
            .from(shopEdition)
            .where(and(eq(shopEdition.id, command.editionId), eq(shopEdition.id, line.editionId)))
            .limit(1);
          if (!edition) {
            throw notFound("Edition");
          }
          // The order line is locked above, so no second task can appear between this read and the
          // insert. A unique violation here would abort the transaction, so it is checked first.
          const [existing] = await shopPhaseDbSession(tx)
            .select({ id: shopProductionTask.id })
            .from(shopProductionTask)
            .where(eq(shopProductionTask.orderLineId, command.orderLineId))
            .limit(1);
          if (existing) {
            return { taskId: existing.id, status: "queued" };
          }
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
          const result: CreateProductionTaskResult = { taskId: task.id, status: "queued" };

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
          const [artwork] = await shopPhaseDbSession(tx)
            .select({ title: shopArtwork.title })
            .from(shopArtwork)
            .where(eq(shopArtwork.id, edition.artworkId))
            .limit(1);
          // Sent only for a task created by this command; a repeat finds the task and returns early.
          await tx.notifications.queueProductionStarted(tx.session, {
            idempotencyKey: `production-started:${result.taskId}`,
            identitySubjectId: order.identitySubjectId,
            fallbackEmail: null,
            orderReference: order.reference,
            artworkTitle: artwork?.title ?? "Your print",
            editionLabel: editionDisplayLabel(edition),
          });
          return result;
        },
      }),
    );
}
