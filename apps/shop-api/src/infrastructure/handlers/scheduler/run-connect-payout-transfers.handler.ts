import type { Database } from "@auction/db";
import { shopPayoutLedger } from "@auction/db/schema";
import { isPayeeConnectReady } from "@auction/shop-domain";
import { and, asc, eq, gt, isNull, ne } from "drizzle-orm";
import type { ShopConnectGateway } from "../../../application/ports/shop-connect.gateway.js";
import type { ShopUnitOfWork } from "../../../application/ports/shop-unit-of-work.js";
import type { ShopPayeeConnectAccountRepository } from "../../drizzle-shop-payee-connect-account.repository.js";
import { shopPhaseDbSession } from "../../drizzle-shop-transaction-effects.js";

export const CONNECT_TRANSFER_ACTOR = "system:stripe-connect";

export type ConnectPayoutTransferRunResult = {
  transferred: number;
  notReady: number;
  failed: { payoutId: string; message: string }[];
};

/**
 * Pays `due` ledger lines to the payee's connected account. Each line is locked for the
 * duration of its Stripe call so a concurrent manual mark-paid waits, then sees `paid` and
 * fails its `status = 'due'` guard. The deterministic idempotency key makes a retry after a
 * lost commit return the same transfer instead of paying twice.
 */
export function createRunConnectPayoutTransfersHandler(deps: {
  db: Database;
  uow: ShopUnitOfWork;
  accounts: ShopPayeeConnectAccountRepository;
  gateway: ShopConnectGateway;
  platformKey: string;
  batchSize?: number;
}): () => Promise<ConnectPayoutTransferRunResult> {
  const batchSize = deps.batchSize ?? 25;

  return async () => {
    const candidates = await deps.db
      .select({ id: shopPayoutLedger.id, ownerPartyId: shopPayoutLedger.ownerPartyId })
      .from(shopPayoutLedger)
      .where(
        and(
          eq(shopPayoutLedger.status, "due"),
          isNull(shopPayoutLedger.blockedReason),
          ne(shopPayoutLedger.payeeKind, "lax"),
          gt(shopPayoutLedger.netPence, 0),
        ),
      )
      .orderBy(asc(shopPayoutLedger.payoutDueAt))
      .limit(batchSize);

    const result: ConnectPayoutTransferRunResult = { transferred: 0, notReady: 0, failed: [] };
    for (const candidate of candidates) {
      const account = await deps.accounts.findForParty(candidate.ownerPartyId);
      if (
        !account ||
        !isPayeeConnectReady({
          payoutsEnabled: account.payoutsEnabled,
          requirementsCurrentlyDue: account.requirementsCurrentlyDue,
          disabledReason: account.disabledReason,
        })
      ) {
        result.notReady += 1;
        continue;
      }
      try {
        const paid = await deps.uow.run(async (tx) => {
          const session = shopPhaseDbSession(tx);
          const [locked] = await session
            .select({ id: shopPayoutLedger.id, netPence: shopPayoutLedger.netPence })
            .from(shopPayoutLedger)
            .where(
              and(
                eq(shopPayoutLedger.id, candidate.id),
                eq(shopPayoutLedger.status, "due"),
                isNull(shopPayoutLedger.blockedReason),
              ),
            )
            .for("update", { skipLocked: true });
          if (!locked) return false;

          const { transferId } = await deps.gateway.createTransfer({
            payoutId: locked.id,
            destinationAccountId: account.stripeConnectAccountId,
            amountPence: locked.netPence,
            idempotencyKey: `shop:payout:transfer:${deps.platformKey}:${locked.id}`,
          });
          const paidAt = new Date();
          await session
            .update(shopPayoutLedger)
            .set({
              status: "paid",
              paidAt,
              paidReference: transferId,
              paidBySubjectId: CONNECT_TRANSFER_ACTOR,
            })
            .where(eq(shopPayoutLedger.id, locked.id));
          await tx.audit.append({
            actorSubjectId: CONNECT_TRANSFER_ACTOR,
            capability: "payout.mark_paid",
            action: "connect_transfer_payout",
            targetType: "shop_payout_ledger",
            targetId: locked.id,
            afterJson: {
              paidReference: transferId,
              paidAt: paidAt.toISOString(),
              stripeConnectAccountId: account.stripeConnectAccountId,
              platformKey: deps.platformKey,
            },
          });
          await tx.events.append({
            aggregateType: "shop_payout_ledger",
            aggregateId: locked.id,
            eventType: "shop.payout.paid",
            payload: { schemaVersion: 1, payoutId: locked.id, paidReference: transferId },
          });
          return true;
        });
        if (paid) result.transferred += 1;
      } catch (error) {
        result.failed.push({
          payoutId: candidate.id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return result;
  };
}
