import type {
  BulkSettlementWithTransfersResult,
  FinanceRuntimeEnv,
} from "@auction/finance-runtime";
import type { Redis } from "ioredis";
import type pino from "pino";
import type { createWorkerPayoutSettlementContext } from "./create-worker-payout-settlement-runtime.js";

export const BULK_PAYOUT_SETTLEMENT_LOCK_KEY = "payout:settlement:lock";
const BULK_PAYOUT_SETTLEMENT_LOCK_TTL_SEC = 30 * 60;

export type WorkerPayoutSettlementContext = ReturnType<typeof createWorkerPayoutSettlementContext>;

export type WorkerBulkPayoutSettlementResult =
  | BulkSettlementWithTransfersResult
  | { skipped: true; reason: "settlement_already_running" };

/** Worker-local bulk payout settlement (settlement + Stripe Connect transfers). */
export async function runWorkerBulkPayoutSettlement(input: {
  env: FinanceRuntimeEnv;
  redis: Redis;
  log: pino.Logger;
  settlement: WorkerPayoutSettlementContext;
}): Promise<WorkerBulkPayoutSettlementResult> {
  if (input.env.DISABLE_PAYOUT_SETTLEMENT) {
    throw new Error("payout_settlement_disabled");
  }
  if (!input.env.STRIPE_SECRET_KEY) {
    throw new Error("stripe_secret_key_required_for_bulk_settlement");
  }

  const lockOk = await input.redis.set(
    BULK_PAYOUT_SETTLEMENT_LOCK_KEY,
    "1",
    "EX",
    BULK_PAYOUT_SETTLEMENT_LOCK_TTL_SEC,
    "NX",
  );
  if (lockOk !== "OK") {
    input.log.warn(
      { lockKey: BULK_PAYOUT_SETTLEMENT_LOCK_KEY, outcome: "deferred" },
      "bulk_payout_settlement_skipped_locked",
    );
    return { skipped: true, reason: "settlement_already_running" as const };
  }

  const log = input.log.child({ component: "bulk_payout_settlement" });

  try {
    return await input.settlement.runtime.runBulkSettlementWithTransfers({
      onEntityOutcome: (row) => {
        log.info(
          {
            legalEntityId: row.legalEntityId,
            payoutId: row.payoutId,
            outcome: row.outcome,
            resume: row.resume ?? false,
            reason: row.reason,
            stripeErrorCode: row.stripeErrorCode,
          },
          "bulk_payout_settlement_entity",
        );
      },
    });
  } finally {
    await input.redis.del(BULK_PAYOUT_SETTLEMENT_LOCK_KEY);
  }
}
