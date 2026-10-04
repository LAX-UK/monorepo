import { shopPayoutLedger } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { and, eq } from "drizzle-orm";
import { operatorContextAuditFields } from "../../../application/admin/operator-context.js";
import { withAdminIdempotency } from "../../../application/admin/with-admin-idempotency.js";
import type { ShopUnitOfWorkFactory } from "../../../application/ports/shop-unit-of-work.js";
import { ShopApiError } from "../../../errors/shop-api-error.js";
import { shopPhaseDbSession } from "../../drizzle-shop-transaction-effects.js";

export type MarkPayoutPaidCommand = {
  payoutId: string;
  paidReference: string;
  actorSubjectId: string;
  idempotencyKey: string;
  operatorContext?: import("../../../application/admin/operator-context.js").ShopOperatorContext;
};

export type MarkPayoutPaidResult = { payoutId: string; status: "paid" };

export function createMarkPayoutPaidHandler(deps: {
  uow: ShopUnitOfWorkFactory;
}): (command: MarkPayoutPaidCommand) => Promise<MarkPayoutPaidResult> {
  return async (command) =>
    deps.uow.run(async (tx) =>
      withAdminIdempotency({
        tx,
        commandType: "payout.mark_paid",
        idempotencyKey: command.idempotencyKey,
        actorSubjectId: command.actorSubjectId,
        requestPayload: command,
        run: async () => {
          const paidAt = new Date();
          const updated = await shopPhaseDbSession(tx)
            .update(shopPayoutLedger)
            .set({
              status: "paid",
              paidAt,
              paidReference: command.paidReference,
              paidBySubjectId: command.actorSubjectId,
            })
            .where(
              and(eq(shopPayoutLedger.id, command.payoutId), eq(shopPayoutLedger.status, "due")),
            )
            .returning({ id: shopPayoutLedger.id });
          if (updated.length !== 1) {
            throw new ShopApiError(
              SHOP_API_ERROR_CODES.CONFLICT,
              "Payout is not due or does not exist",
              409,
            );
          }
          await tx.audit.append({
            actorSubjectId: command.actorSubjectId,
            capability: "payout.mark_paid",
            action: "mark_payout_paid",
            targetType: "shop_payout_ledger",
            targetId: command.payoutId,
            afterJson: {
              paidReference: command.paidReference,
              paidAt: paidAt.toISOString(),
              ...operatorContextAuditFields(command.operatorContext),
            },
          });
          await tx.events.append({
            aggregateType: "shop_payout_ledger",
            aggregateId: command.payoutId,
            eventType: "shop.payout.paid",
            payload: {
              schemaVersion: 1,
              payoutId: command.payoutId,
              paidReference: command.paidReference,
            },
          });
          return { payoutId: command.payoutId, status: "paid" as const };
        },
      }),
    );
}
