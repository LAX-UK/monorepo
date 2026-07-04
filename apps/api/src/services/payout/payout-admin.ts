import type { ReconcileStripeTransferPatch } from "@auction/persistence/interfaces";
import type { CreatePayoutAdjustmentInput, Payout, PayoutLineKind } from "@auction/types";
import { addDecimal, subtractDecimal, sumDecimal } from "../../lib/decimal-money.js";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type {
  AdminListPayoutsFilter,
  MarkPaidInput,
  PayoutWithLines,
  StripeTransferReconciliationInput,
} from "../interfaces/payout.js";
import { PayoutNotFoundError, PayoutStatusTransitionError } from "../interfaces/payout.js";
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

export async function markPaid(
  deps: PayoutServiceDeps,
  actorUserId: string,
  payoutId: string,
  input: MarkPaidInput,
): Promise<Payout> {
  const publisher = deps.domainEventSink;
  if (!deps.transactionRunner || !publisher) {
    const found = await deps.repo.findById(payoutId);
    if (!found) throw new PayoutNotFoundError();
    if (found.status === "paid") {
      throw new PayoutStatusTransitionError("payout_already_paid");
    }
    if (found.status !== "scheduled" && found.status !== "in_transit") {
      throw new PayoutStatusTransitionError("cannot_pay_payout_in_state");
    }
    return await deps.repo.updateStatus(payoutId, {
      status: "paid",
      stripeTransferId: input.stripeTransferId,
      processedAt: new Date(),
      failureReason: null,
    });
  }

  return await deps.transactionRunner.runInTransaction(async (tx) => {
    const r = deps.payoutRepoForTx(tx);
    const found = await r.findById(payoutId);
    if (!found) throw new PayoutNotFoundError();
    if (found.status === "paid") {
      throw new PayoutStatusTransitionError("payout_already_paid");
    }
    if (found.status !== "scheduled" && found.status !== "in_transit") {
      throw new PayoutStatusTransitionError("cannot_pay_payout_in_state");
    }
    const updated = await r.updateStatus(payoutId, {
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

  const publisher = deps.domainEventSink;
  if (!deps.transactionRunner || !publisher) {
    return await deps.repo.reconcileStripeTransfer(found.id, patch);
  }

  return await deps.transactionRunner.runInTransaction(async (tx) => {
    const r = deps.payoutRepoForTx(tx);
    const row = await r.findById(found.id);
    if (!row) return null;
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

    return updated;
  });
}

export async function adminManualReverse(
  deps: PayoutServiceDeps,
  actorUserId: string,
  payoutId: string,
  input: { reason: string },
): Promise<Payout> {
  const publisher = deps.domainEventSink;
  if (!deps.transactionRunner || !publisher) {
    const found = await deps.repo.findById(payoutId);
    if (!found) throw new PayoutNotFoundError();
    if (found.status !== "paid" && found.status !== "in_transit") {
      throw new PayoutStatusTransitionError("cannot_reverse_payout_in_state");
    }
    return await deps.repo.updateStatus(payoutId, {
      status: "reversed",
      failureReason: input.reason,
    });
  }

  return await deps.transactionRunner.runInTransaction(async (tx) => {
    const r = deps.payoutRepoForTx(tx);
    const found = await r.findById(payoutId);
    if (!found) throw new PayoutNotFoundError();
    if (found.status !== "paid" && found.status !== "in_transit") {
      throw new PayoutStatusTransitionError("cannot_reverse_payout_in_state");
    }
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
    const updated = await r.updateStatus(payoutId, {
      status: "reversed",
      failureReason: input.reason,
    });
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
}
