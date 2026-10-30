import { type PayoutReversalRefusal, payoutReversalRefusal } from "@auction/domain";
import type {
  IPayoutRepository,
  ReconcileStripeTransferPatch,
} from "@auction/persistence/interfaces";
import type { CreatePayoutAdjustmentInput, Payout, PayoutLineKind } from "@auction/types";
import { roleHasCapability } from "@auction/types";
import { addDecimal, subtractDecimal, sumDecimal } from "../../lib/decimal-money.js";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type { AdminPayoutListPage } from "../admin/admin-payout-list-query.service.js";
import { AdminPayoutListQueryService } from "../admin/admin-payout-list-query.service.js";
import type {
  AdminListPayoutsFilter,
  MarkPaidInput,
  PayoutWithLines,
  StripeTransferReconciliationInput,
} from "../interfaces/payout.js";
import {
  PayoutNotFoundError,
  PayoutPermissionError,
  type PayoutReversalActor,
  PayoutStatusTransitionError,
} from "../interfaces/payout.js";
import { DEFAULT_CURRENCY, type PayoutServiceDeps, settlementAmounts } from "./payout-helpers.js";

export async function adminList(
  deps: PayoutServiceDeps,
  filter: AdminListPayoutsFilter = {},
): Promise<Payout[]> {
  return await deps.repo.list({
    ...(filter.legalEntityId !== undefined ? { legalEntityId: filter.legalEntityId } : {}),
    ...(filter.status !== undefined ? { status: filter.status } : {}),
    ...(filter.limit !== undefined ? { limit: filter.limit } : {}),
    ...(filter.offset !== undefined ? { offset: filter.offset } : {}),
  });
}

export async function adminListPage(
  deps: PayoutServiceDeps,
  filter: AdminListPayoutsFilter & { limit: number; offset: number },
): Promise<AdminPayoutListPage> {
  return await new AdminPayoutListQueryService(deps.repo).getPage(filter);
}

export async function adminSettlementPreview(deps: PayoutServiceDeps, legalEntityId: string) {
  const [pending, openPayout] = await Promise.all([
    previewPending(deps, legalEntityId),
    deps.repo.findOpenPayoutForEntity(legalEntityId),
  ]);
  return { pending, openPayout };
}

export async function previewPending(
  deps: PayoutServiceDeps,
  legalEntityId: string,
): Promise<import("../interfaces/payout.js").PendingPayoutPreview> {
  const rows = await deps.repo.findUnlinkedCapturedPayments(legalEntityId);
  const settled = rows.map(settlementAmounts);
  const grossAmount = sumDecimal(settled.map((r) => r.saleAmount));
  const platformFee = sumDecimal(settled.map((r) => r.platformFee));
  return {
    pendingGross: grossAmount,
    pendingPlatformFee: platformFee,
    pendingNet: subtractDecimal(grossAmount, platformFee),
    paymentCount: rows.length,
    currency: DEFAULT_CURRENCY,
  };
}

export async function addAdjustment(
  deps: PayoutServiceDeps,
  actorUserId: string,
  payoutId: string,
  input: CreatePayoutAdjustmentInput,
  kind: PayoutLineKind = "adjustment",
): Promise<PayoutWithLines> {
  const found = await deps.repo.findById(payoutId);
  if (!found) throw new PayoutNotFoundError();
  if (found.status !== "scheduled" && found.status !== "in_transit") {
    throw new PayoutStatusTransitionError("cannot_adjust_payout_in_terminal_state");
  }

  await deps.repo.insertLine({
    payoutId,
    paymentId: null,
    amount: input.amount,
    kind,
    createdByUserId: actorUserId,
    note: input.note,
  });

  if (deps.payoutAdjustments) {
    await deps.payoutAdjustments.recalculateTotalsFromLines(deps.repo, payoutId);
  } else {
    const newGross = addDecimal(found.grossAmount, input.amount);
    const newNet = subtractDecimal(subtractDecimal(newGross, found.platformFee), found.stripeFee);
    await deps.repo.updateTotals(payoutId, {
      grossAmount: newGross,
      platformFee: found.platformFee,
      netAmount: newNet,
    });
  }

  const updated = (await deps.repo.findById(payoutId)) ?? found;
  const lines = await deps.repo.listLines(payoutId);
  return { ...updated, lines };
}

/**
 * Moves a payout to a new status only if it still holds the status that was read.
 * When another writer changed it first, nothing is written and the caller gets a
 * transition error naming the state it now holds.
 */
async function transitionOrThrow(
  r: IPayoutRepository,
  found: Payout,
  patch: Parameters<IPayoutRepository["updateStatusIfCurrent"]>[2],
): Promise<Payout> {
  const updated = await r.updateStatusIfCurrent(found.id, found.status, patch);
  if (updated) return updated;
  const current = await r.findById(found.id);
  if (!current) throw new PayoutNotFoundError();
  if (current.status === patch.status && patch.status === "paid") {
    throw new PayoutStatusTransitionError("payout_already_paid");
  }
  throw new PayoutStatusTransitionError("payout_state_changed");
}

function requireTransactional(deps: PayoutServiceDeps) {
  const runner = deps.transactionRunner;
  const publisher = deps.domainEventSink;
  if (!runner || !publisher) throw new Error("payout_transactions_not_configured");
  return { runner, publisher };
}

export async function markPaid(
  deps: PayoutServiceDeps,
  actorUserId: string,
  payoutId: string,
  input: MarkPaidInput,
): Promise<Payout> {
  const { runner, publisher } = requireTransactional(deps);

  return await runner.runInTransaction(async (tx) => {
    const r = deps.payoutRepoForTx(tx);
    const found = await r.findById(payoutId);
    if (!found) throw new PayoutNotFoundError();
    if (found.status === "paid") {
      throw new PayoutStatusTransitionError("payout_already_paid");
    }
    if (found.status !== "scheduled" && found.status !== "in_transit") {
      throw new PayoutStatusTransitionError("cannot_pay_payout_in_state");
    }
    const updated = await transitionOrThrow(r, found, {
      status: "paid",
      stripeTransferId: input.stripeTransferId,
      processedAt: new Date(),
      failureReason: null,
    });
    await publisher.withTx(tx).publish({
      aggregateType: "payout",
      aggregateId: updated.id,
      eventType: "payout.paid",
      payload: {
        legalEntityId: updated.legalEntityId,
        status: updated.status,
        stripeTransferId: updated.stripeTransferId,
        grossAmount: updated.grossAmount,
        platformFee: updated.platformFee,
        stripeFee: updated.stripeFee,
        netAmount: updated.netAmount,
        currency: updated.currency,
        processedAt: updated.processedAt?.toISOString() ?? null,
        via: "mark_paid",
      },
      actorUserId,
      actingLegalEntityId: updated.legalEntityId,
    });
    return updated;
  });
}

export async function reconcileStripeTransfer(
  deps: PayoutServiceDeps,
  input: StripeTransferReconciliationInput,
): Promise<Payout | null> {
  const found = input.payoutId
    ? await deps.repo.findById(input.payoutId)
    : await deps.repo.findByStripeTransferId(input.stripeTransferId);
  if (!found) return null;

  const status: ReconcileStripeTransferPatch["status"] = input.status;
  const processedAt = status === "paid" ? (input.occurredAt ?? new Date()) : found.processedAt;

  const patch: ReconcileStripeTransferPatch = {
    stripeTransferId: input.stripeTransferId,
    status,
    ...(input.stripeFee !== undefined ? { stripeFee: input.stripeFee } : {}),
    processedAt,
    failureReason: null,
  };

  const { runner, publisher } = requireTransactional(deps);

  const outcome = await runner.runInTransaction(async (tx) => {
    const r = deps.payoutRepoForTx(tx);
    // Row lock: concurrent Stripe events for one payout apply one after another, so each
    // sees the previous status and emits its payout event only on a real transition.
    const row = await r.findByIdForUpdate(found.id);
    if (!row) return { payout: null, problem: false };
    // A transfer that was reversed by staff or Stripe is never re-marked paid by a late event.
    if (row.status === "reversed" && patch.status === "paid")
      return { payout: row, problem: false };
    const previousStatus = row.status;
    const updated = await r.reconcileStripeTransfer(row.id, patch);

    if (updated.status === "paid" && previousStatus !== "paid") {
      await publisher.withTx(tx).publish({
        aggregateType: "payout",
        aggregateId: updated.id,
        eventType: "payout.paid",
        payload: {
          legalEntityId: updated.legalEntityId,
          status: updated.status,
          stripeTransferId: updated.stripeTransferId,
          grossAmount: updated.grossAmount,
          platformFee: updated.platformFee,
          stripeFee: updated.stripeFee,
          netAmount: updated.netAmount,
          currency: updated.currency,
          processedAt: updated.processedAt?.toISOString() ?? null,
          via: "stripe_reconcile",
        },
        actorUserId: null,
        actingLegalEntityId: updated.legalEntityId,
      });
    }

    if (
      updated.status === "reversed" &&
      previousStatus !== "reversed" &&
      input.stripeEventId &&
      input.reversedAmountCents !== undefined
    ) {
      const negativeAmount = (-(input.reversedAmountCents / 100)).toFixed(2);
      await r.insertLine({
        payoutId: updated.id,
        paymentId: null,
        amount: negativeAmount,
        kind: "reversal",
        createdByUserId: null,
        note: `Transfer reversed: ${input.stripeTransferId}`,
        sourceEventId: input.stripeEventId,
      });
      if (deps.payoutAdjustments) {
        await deps.payoutAdjustments.recalculateTotalsFromLines(r, updated.id);
      }

      await publisher.withTx(tx).publish({
        aggregateType: "payout",
        aggregateId: updated.id,
        eventType: "payout.transfer_reversed",
        payload: {
          legalEntityId: updated.legalEntityId,
          stripeTransferId: updated.stripeTransferId,
          reversedAmountCents: input.reversedAmountCents,
          currency: updated.currency,
          stripeEventId: input.stripeEventId,
        },
        actorUserId: null,
        actingLegalEntityId: updated.legalEntityId,
      });
    }

    if (updated.status === "failed" && previousStatus !== "failed") {
      recordMoneyPathEvent("payout_reconciled_failed");
    }

    const problem = PROBLEM_STATUSES.has(updated.status) && updated.status !== previousStatus;
    return { payout: updated, problem };
  });
  if (outcome.problem && outcome.payout) {
    await deps.problemNotifier?.payoutProblem(outcome.payout);
  }
  return outcome.payout;
}

/** Payout states the account is told about: the money did not arrive. */
const PROBLEM_STATUSES: ReadonlySet<string> = new Set(["failed", "reversed"]);

const PAYOUT_REVERSAL_REFUSAL_CODES: Record<PayoutReversalRefusal, string> = {
  not_permitted: "payout_reversal_not_permitted",
  processed_payout: "payout_reversal_by_processor",
};

export async function adminManualReverse(
  deps: PayoutServiceDeps,
  actor: PayoutReversalActor,
  payoutId: string,
  input: { reason: string },
): Promise<Payout> {
  const { runner, publisher } = requireTransactional(deps);
  const actorUserId = actor.userId;

  const reversed = await runner.runInTransaction(async (tx) => {
    const r = deps.payoutRepoForTx(tx);
    const found = await r.findById(payoutId);
    if (!found) throw new PayoutNotFoundError();
    const refusal = payoutReversalRefusal({
      actorUserId,
      actorMayReverse: roleHasCapability("staff", "payout.reverse", actor.staffRoles),
      processedByUserIds: await deps.payoutProcessorsForTx(tx).listProcessorUserIds(payoutId),
    });
    if (refusal) throw new PayoutPermissionError(PAYOUT_REVERSAL_REFUSAL_CODES[refusal]);
    if (found.status === "reversed") {
      throw new PayoutStatusTransitionError("payout_already_reversed");
    }
    if (found.status !== "paid" && found.status !== "in_transit") {
      throw new PayoutStatusTransitionError("cannot_reverse_payout_in_state");
    }
    // Claim the transition first so a losing caller writes no reversal line.
    const claimed = await transitionOrThrow(r, found, {
      status: "reversed",
      failureReason: input.reason,
    });
    const negativeAmount = (-Number.parseFloat(found.netAmount)).toFixed(2);
    await r.insertLine({
      payoutId: found.id,
      paymentId: null,
      amount: negativeAmount,
      kind: "reversal",
      createdByUserId: actorUserId,
      note: `Admin reversal: ${input.reason}`,
      sourceEventId: `admin_reverse:${payoutId}`,
    });
    if (deps.payoutAdjustments) {
      await deps.payoutAdjustments.recalculateTotalsFromLines(r, found.id);
    }
    const updated = (await r.findById(payoutId)) ?? claimed;
    await publisher.withTx(tx).publish({
      aggregateType: "payout",
      aggregateId: updated.id,
      eventType: "payout.reversed",
      payload: {
        legalEntityId: updated.legalEntityId,
        reason: input.reason,
        via: "admin_manual",
        previousStatus: found.status,
      },
      actorUserId,
      actingLegalEntityId: updated.legalEntityId,
      schemaVersion: 1,
    });
    return updated;
  });
  await deps.problemNotifier?.payoutProblem(reversed);
  return reversed;
}
