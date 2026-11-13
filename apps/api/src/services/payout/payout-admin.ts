import {
  type PayoutReversalRefusal,
  payoutReversalRefusal,
  payoutTakesLines,
  payoutTotals,
} from "@auction/domain";
import { previewSettlement } from "@auction/finance-runtime";
import type {
  IPayoutRepository,
  ReconcileStripeTransferPatch,
} from "@auction/persistence/interfaces";
import type { CreatePayoutAdjustmentInput, Payout, PayoutLineKind } from "@auction/types";
import { roleHasCapability } from "@auction/types";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type { AdminPayoutListPage } from "../admin/admin-payout-list-query.service.js";
import { AdminPayoutListQueryService } from "../admin/admin-payout-list-query.service.js";
import type {
  AdminListPayoutsFilter,
  MarkPaidInput,
  PayoutWithLines,
  PendingPreviewDeal,
  PendingPreviewSale,
  PendingPreviewSaleLabel,
  PendingPreviewTotals,
  StripeTransferReconciliationInput,
} from "../interfaces/payout.js";
import {
  PayoutNotFoundError,
  PayoutPermissionError,
  type PayoutReversalActor,
  PayoutStatusTransitionError,
} from "../interfaces/payout.js";
import { DEFAULT_CURRENCY, type PayoutServiceDeps } from "./payout-helpers.js";

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

/**
 * The next payout for a seller, priced as the run prices it: each sale from its seller terms, with
 * held sales counted apart. Read in a transaction so the run's own readers are used; nothing is
 * stored.
 */
export async function previewPending(
  deps: PayoutServiceDeps,
  legalEntityId: string,
): Promise<import("../interfaces/payout.js").PendingPayoutPreview> {
  if (!deps.transactionRunner) throw new Error("payout_transactions_not_configured");
  const preview = await deps.transactionRunner.runInTransaction((tx) =>
    previewSettlement(
      deps.payoutRepoForTx(tx),
      deps.sellerTermsForTx(tx),
      legalEntityId,
      // The run's own source of released deals, read through the same transaction.
      deps.dealPayoutsForTx?.(tx) ?? null,
    ),
  );
  const labels = await labelsFor(deps, preview.sales);
  const sales = preview.sales.map(
    (sale): PendingPreviewSale => ({
      ...sale,
      ...(labels.get(sale.lotId ?? "") ?? { lotNumber: null, lotTitle: null, agreement: null }),
    }),
  );
  return {
    sales,
    deals: preview.deals,
    totals: previewTotals(sales, preview.deals),
    pendingGross: preview.pendingGross,
    pendingPlatformFee: preview.pendingPlatformFee,
    pendingNet: preview.pendingNet,
    paymentCount: preview.paymentCount,
    heldCount: preview.heldSales.length,
    currency: DEFAULT_CURRENCY,
    earliestCapturedAt: preview.earliestCapturedAt,
  };
}

async function labelsFor(
  deps: PayoutServiceDeps,
  sales: readonly { lotId: string | null }[],
): Promise<Map<string, PendingPreviewSaleLabel>> {
  const lotIds = sales.flatMap((sale) => (sale.lotId ? [sale.lotId] : []));
  if (!deps.saleLabels || lotIds.length === 0) return new Map();
  const labels = await deps.saleLabels.saleLabels(lotIds);
  return new Map(
    labels.map((label) => [
      label.lotId,
      {
        lotNumber: label.lotNumber,
        lotTitle: label.lotTitle,
        agreement: label.agreement && {
          reference: label.agreement.reference,
          submissionId: label.agreement.submissionId,
          signedAt: label.agreement.signedAt,
          source: label.agreement.source,
        },
      },
    ]),
  );
}

/**
 * The preview's totals are its ready lines and deals added up, so the screen never shows a second
 * sum and the net is what the run pays.
 */
export function previewTotals(
  sales: readonly PendingPreviewSale[],
  deals: readonly PendingPreviewDeal[] = [],
): PendingPreviewTotals {
  const totals: PendingPreviewTotals = {
    hammerPence: 0,
    commissionPence: 0,
    commissionVatPence: 0,
    refundChargePence: 0,
    dealsNetPence: 0,
    netPence: 0,
  };
  for (const deal of deals) {
    totals.dealsNetPence += deal.netPence;
    totals.netPence += deal.netPence;
  }
  for (const sale of sales) {
    if (sale.kind !== "ready") continue;
    totals.hammerPence += sale.hammerPence;
    totals.commissionPence += sale.commissionPence;
    totals.commissionVatPence += sale.commissionVatPence;
    totals.refundChargePence += sale.refundChargePence;
    totals.netPence += sale.netPence;
  }
  return totals;
}

export async function addAdjustment(
  deps: PayoutServiceDeps,
  actorUserId: string,
  payoutId: string,
  input: CreatePayoutAdjustmentInput,
  kind: PayoutLineKind = "adjustment",
): Promise<PayoutWithLines> {
  const { runner } = requireTransactional(deps);
  return runner.runInTransaction(async (tx) => {
    const r = deps.payoutRepoForTx(tx);
    // The transfer step holds this row from reading the amount until the payout has left
    // `scheduled`, so an adjustment either goes out with the transfer or is refused. A payout
    // whose last attempt has an unknown outcome is refused too: Stripe may hold its old amount.
    const found = await r.findByIdForUpdate(payoutId);
    if (!found) throw new PayoutNotFoundError();
    if (!payoutTakesLines(found)) {
      throw new PayoutStatusTransitionError("cannot_adjust_payout_in_terminal_state");
    }

    await r.insertLine({
      payoutId,
      paymentId: null,
      amount: input.amount,
      kind,
      createdByUserId: actorUserId,
      note: input.note,
    });

    if (deps.payoutAdjustments) {
      await deps.payoutAdjustments.recalculateTotalsFromLines(r, payoutId);
    } else {
      const totals = payoutTotals(await r.listLines(payoutId), found.stripeFee);
      await r.updateTotals(payoutId, {
        grossAmount: totals.gross,
        platformFee: totals.platformFee,
        netAmount: totals.net,
      });
    }

    const updated = (await r.findById(payoutId)) ?? found;
    const lines = await r.listLines(payoutId);
    return { ...updated, lines };
  });
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

/** A Postgres unique violation, possibly wrapped by the driver layer. */
/** The unique index on payout.stripe_transfer_id (declared inline in 0027, so Postgres names it). */
const PAYOUT_TRANSFER_ID_UNIQUE = "payout_stripe_transfer_id_key";

/** True only when the transfer id is already held by another payout; any other error passes through. */
function isTransferAlreadyLinked(err: unknown): boolean {
  const e = err as {
    code?: unknown;
    constraint?: unknown;
    cause?: { code?: unknown; constraint?: unknown };
  } | null;
  const pg = e?.code === "23505" ? e : e?.cause?.code === "23505" ? e.cause : null;
  return pg?.constraint === PAYOUT_TRANSFER_ID_UNIQUE;
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
        reason: input.reason,
      },
      actorUserId,
      actingLegalEntityId: updated.legalEntityId,
    });
    return updated;
  });
}

/** What staff gave for resolving a blocked payout; the reason is kept in the audit event. */
export type BlockedPayoutResolutionInput = { reason: string };

/**
 * Staff adopt a Stripe transfer for a `transfer_blocked` payout: it moves to `in_transit` with
 * that transfer. The transfer was checked against Stripe by the caller; here the payout is moved
 * only if it is still blocked and the transfer is not already linked to another payout, in one
 * transaction with the event.
 */
export async function adoptBlockedTransfer(
  deps: PayoutServiceDeps,
  actorUserId: string,
  payoutId: string,
  input: BlockedPayoutResolutionInput & { stripeTransferId: string },
): Promise<Payout> {
  const { runner, publisher } = requireTransactional(deps);
  return await runner.runInTransaction(async (tx) => {
    const r = deps.payoutRepoForTx(tx);
    const found = await r.findById(payoutId);
    if (!found) throw new PayoutNotFoundError();
    if (found.status !== "transfer_blocked") {
      throw new PayoutStatusTransitionError("payout_not_blocked");
    }
    const linked = await r.findByStripeTransferId(input.stripeTransferId);
    if (linked && linked.id !== payoutId) {
      throw new PayoutStatusTransitionError("transfer_linked_to_other_payout");
    }
    let updated: Payout;
    try {
      updated = await transitionOrThrow(r, found, {
        status: "in_transit",
        stripeTransferId: input.stripeTransferId,
        processedAt: null,
        failureReason: null,
      });
    } catch (err) {
      // Two staff adopting the same transfer onto two payouts: the unique index lets one win.
      if (isTransferAlreadyLinked(err)) {
        throw new PayoutStatusTransitionError("transfer_linked_to_other_payout");
      }
      throw err;
    }
    await publisher.withTx(tx).publish({
      aggregateType: "payout",
      aggregateId: updated.id,
      eventType: "payout.transfer_block_resolved",
      payload: {
        legalEntityId: updated.legalEntityId,
        resolution: "adopt_transfer",
        previousStatus: found.status,
        status: updated.status,
        stripeTransferId: input.stripeTransferId,
        reason: input.reason,
      },
      actorUserId,
      actingLegalEntityId: updated.legalEntityId,
    });
    return updated;
  });
}

/**
 * Staff release a `transfer_blocked` payout to `failed` so it can be retried, having checked in
 * Stripe that no live transfer exists. The confirmation and reason are kept in the event. The
 * failure time is set now, so the retry cool-off applies and the retry gets a fresh idempotency
 * key.
 */
export async function releaseBlockedPayout(
  deps: PayoutServiceDeps,
  actorUserId: string,
  payoutId: string,
  input: BlockedPayoutResolutionInput & { noLiveTransferConfirmed: true },
): Promise<Payout> {
  const { runner, publisher } = requireTransactional(deps);
  return await runner.runInTransaction(async (tx) => {
    const r = deps.payoutRepoForTx(tx);
    const found = await r.findById(payoutId);
    if (!found) throw new PayoutNotFoundError();
    if (found.status !== "transfer_blocked") {
      throw new PayoutStatusTransitionError("payout_not_blocked");
    }
    const updated = await transitionOrThrow(r, found, {
      status: "failed",
      stripeTransferId: null,
      processedAt: new Date(),
      failureReason: `released_from_transfer_blocked: ${found.failureReason ?? "no reason recorded"}`,
    });
    await publisher.withTx(tx).publish({
      aggregateType: "payout",
      aggregateId: updated.id,
      eventType: "payout.transfer_block_resolved",
      payload: {
        legalEntityId: updated.legalEntityId,
        resolution: "release_to_failed",
        previousStatus: found.status,
        status: updated.status,
        noLiveTransferConfirmed: input.noLiveTransferConfirmed,
        reason: input.reason,
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
