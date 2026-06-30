import type {
  BulkPayoutSettlementResult,
  BulkSettlementEntityOutcomeLog,
  BulkSettlementTransferPort,
  BulkSettlementWithTransfersResult,
} from "../interfaces/payout.js";
import type { InitiateTransferResult } from "../interfaces/stripe-connect.js";
import type { PayoutServiceDeps } from "./payout-helpers.js";
import { createSettlement } from "./payout-settlement.js";

export function outcomeFromTransfer(
  legalEntityId: string,
  payoutId: string,
  tr: InitiateTransferResult,
  resume: boolean,
): BulkSettlementEntityOutcomeLog {
  if (tr.ok) {
    if (tr.stripeTransferId === "zero_amount_skipped") {
      return {
        legalEntityId,
        payoutId,
        resume,
        outcome: "committed_no_transfer",
        reason: "zero_amount_skipped",
      };
    }
    return {
      legalEntityId,
      payoutId,
      resume,
      outcome: "transfer_initiated",
      stripeTransferId: tr.stripeTransferId,
    };
  }
  if (tr.reason === "connect_not_ready") {
    return { legalEntityId, payoutId, resume, outcome: "connect_not_ready" };
  }
  if (tr.reason === "stripe_error") {
    return {
      legalEntityId,
      payoutId,
      resume,
      outcome: "transfer_failed",
      ...(tr.stripeErrorMessage !== undefined ? { reason: tr.stripeErrorMessage } : {}),
      ...(tr.stripeErrorCode !== undefined ? { stripeErrorCode: tr.stripeErrorCode } : {}),
    };
  }
  if (tr.reason === "payout_already_processed") {
    return { legalEntityId, payoutId, resume, outcome: "transfer_skipped", reason: tr.reason };
  }
  return {
    legalEntityId,
    payoutId,
    resume,
    outcome: "committed_no_transfer",
    reason: tr.reason,
  };
}

export function summarizeTransferOutcomes(
  items: BulkSettlementEntityOutcomeLog[],
): Record<string, number> {
  const by: Record<string, number> = {};
  for (const i of items) {
    by[i.outcome] = (by[i.outcome] ?? 0) + 1;
  }
  return by;
}

export async function runBulkSettlementWithTransfers(
  deps: PayoutServiceDeps,
  actorUserId: string | null,
  port: BulkSettlementTransferPort,
  opts?: { periodEnd?: Date },
): Promise<BulkSettlementWithTransfersResult> {
  const periodEnd = opts?.periodEnd ?? new Date();
  const periodStart = new Date(0);
  const settlementItems: BulkPayoutSettlementResult["items"] = [];
  const transferLog: BulkSettlementEntityOutcomeLog[] = [];
  const attemptedTransferPayoutIds = new Set<string>();

  const pushTransferLog = (row: BulkSettlementEntityOutcomeLog) => {
    transferLog.push(row);
    port.onEntityOutcome?.(row);
  };

  const legalEntityIds = await deps.repo.listLegalEntityIdsWithUnlinkedCapturedPayments();

  for (const legalEntityId of legalEntityIds) {
    try {
      const result = await createSettlement(deps, actorUserId, {
        legalEntityId,
        periodStart,
        periodEnd,
      });
      if (!result.ok) {
        settlementItems.push({ legalEntityId, outcome: "skipped", reason: result.reason });
        pushTransferLog({
          legalEntityId,
          outcome: "settlement_skipped",
          reason: result.reason,
          resume: false,
        });
        continue;
      }
      settlementItems.push({
        legalEntityId,
        outcome: "created",
        payoutId: result.payout.id,
      });
      const payoutId = result.payout.id;
      attemptedTransferPayoutIds.add(payoutId);
      const tr = await port.initiateTransfer(payoutId, {
        keepScheduledOnTransferFailure: true,
      });
      pushTransferLog(outcomeFromTransfer(legalEntityId, payoutId, tr, false));
    } catch (err) {
      settlementItems.push({
        legalEntityId,
        outcome: "error",
        message: err instanceof Error ? err.message : String(err),
      });
      pushTransferLog({
        legalEntityId,
        outcome: "settlement_db_error",
        reason: err instanceof Error ? err.message : String(err),
        resume: false,
      });
    }
  }

  const resumePayouts = await deps.repo.listScheduledPayoutsAwaitingTransfer(1000);
  for (const p of resumePayouts) {
    if (attemptedTransferPayoutIds.has(p.id)) {
      continue;
    }
    attemptedTransferPayoutIds.add(p.id);
    const tr = await port.initiateTransfer(p.id, { keepScheduledOnTransferFailure: true });
    pushTransferLog(outcomeFromTransfer(p.legalEntityId, p.id, tr, true));
  }

  const createdCount = settlementItems.filter((i) => i.outcome === "created").length;
  return {
    settlement: {
      eligibleEntityCount: legalEntityIds.length,
      createdCount,
      items: settlementItems,
    },
    transfers: {
      items: transferLog,
      summary: {
        totalTransferAttempts: transferLog.length,
        byOutcome: summarizeTransferOutcomes(transferLog),
      },
    },
  };
}
