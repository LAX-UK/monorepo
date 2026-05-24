import type { Database } from "@auction/db";
import type {
  CreatePayoutAdjustmentInput,
  Payout,
  PayoutLine,
  PayoutLineKind,
} from "@auction/types";
import { addDecimal, subtractDecimal, sumDecimal } from "../lib/decimal-money.js";
import { recordMoneyPathEvent } from "../middleware/metrics.js";
import { DrizzlePayoutRepository } from "../repositories/drizzle-payout.repository.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type { IPayoutAdjustmentService } from "./interfaces/payout-adjustment.js";
import type {
  IPayoutRepository,
  ReconcileStripeTransferPatch,
} from "./interfaces/payout-repository.js";
import type {
  AdminListPayoutsFilter,
  BulkPayoutSettlementResult,
  BulkSettlementEntityOutcomeLog,
  BulkSettlementTransferPort,
  BulkSettlementWithTransfersResult,
  CreateSettlementInput,
  CreateSettlementResult,
  IPayoutService,
  ListPayoutsFilter,
  MarkPaidInput,
  PayoutWithLines,
  PendingPayoutPreview,
  StripeTransferReconciliationInput,
} from "./interfaces/payout.js";
import {
  PayoutNotFoundError,
  PayoutPermissionError,
  PayoutStatusTransitionError,
} from "./interfaces/payout.js";
import type { InitiateTransferResult } from "./interfaces/stripe-connect.js";

const DEFAULT_CURRENCY = "GBP";

function settlementAmounts(p: { amount: string; platformFee: string; settlementAmount?: string }): {
  saleAmount: string;
  platformFee: string;
} {
  const saleAmount = p.settlementAmount ?? p.amount;
  const full = Number.parseFloat(p.amount);
  const ratio = full > 0 ? Number.parseFloat(saleAmount) / full : 1;
  return {
    saleAmount,
    platformFee: (Number.parseFloat(p.platformFee) * ratio).toFixed(2),
  };
}

function outcomeFromTransfer(
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

function summarizeTransferOutcomes(
  items: BulkSettlementEntityOutcomeLog[],
): Record<string, number> {
  const by: Record<string, number> = {};
  for (const i of items) {
    by[i.outcome] = (by[i.outcome] ?? 0) + 1;
  }
  return by;
}

export class PayoutService implements IPayoutService {
  constructor(
    private readonly repo: IPayoutRepository,
    private readonly db?: Database,
    private readonly domainEventPublisher?: DomainEventPublisher,
    private readonly payoutAdjustments?: IPayoutAdjustmentService,
  ) {}

  async listForLegalEntity(
    legalEntityId: string,
    filter: ListPayoutsFilter = {},
  ): Promise<Payout[]> {
    return await this.repo.list({
      legalEntityId,
      ...(filter.status !== undefined ? { status: filter.status } : {}),
      ...(filter.limit !== undefined ? { limit: filter.limit } : {}),
      ...(filter.offset !== undefined ? { offset: filter.offset } : {}),
    });
  }

  async getById(legalEntityId: string, payoutId: string): Promise<PayoutWithLines> {
    const found = await this.repo.findById(payoutId);
    if (!found) throw new PayoutNotFoundError();
    if (found.legalEntityId !== legalEntityId) {
      throw new PayoutPermissionError("not_owner_of_payout");
    }
    const lines = await this.repo.listLines(payoutId);
    return { ...found, lines };
  }

  async previewPending(legalEntityId: string): Promise<PendingPayoutPreview> {
    const rows = await this.repo.findUnlinkedCapturedPayments(legalEntityId);
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

  async adminList(filter: AdminListPayoutsFilter = {}): Promise<Payout[]> {
    return await this.repo.list({
      ...(filter.legalEntityId !== undefined ? { legalEntityId: filter.legalEntityId } : {}),
      ...(filter.status !== undefined ? { status: filter.status } : {}),
      ...(filter.limit !== undefined ? { limit: filter.limit } : {}),
      ...(filter.offset !== undefined ? { offset: filter.offset } : {}),
    });
  }

  private async createSettlementCore(
    r: IPayoutRepository,
    input: CreateSettlementInput,
  ): Promise<CreateSettlementResult> {
    const pending = await r.findUnlinkedCapturedPayments(input.legalEntityId);
    if (pending.length === 0) {
      return { ok: false, reason: "no_pending_payments" };
    }

    const settled = pending.map((p) => ({ ...p, ...settlementAmounts(p) }));
    const grossAmount = sumDecimal(settled.map((p) => p.saleAmount));
    const platformFee = sumDecimal(settled.map((p) => p.platformFee));
    const stripeFee = "0.00";
    const netAmount = subtractDecimal(subtractDecimal(grossAmount, platformFee), stripeFee);

    const created = await r.create({
      legalEntityId: input.legalEntityId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      grossAmount,
      platformFee,
      stripeFee,
      netAmount,
      currency: DEFAULT_CURRENCY,
    });

    const inserted: { line: PayoutLine; platformFee: string }[] = [];
    for (const p of settled) {
      const line = await r.tryInsertSaleLine({
        payoutId: created.id,
        paymentId: p.id,
        amount: p.saleAmount,
        kind: "sale",
        createdByUserId: null,
        note: null,
      });
      if (line) {
        inserted.push({ line, platformFee: p.platformFee });
      }
    }

    if (inserted.length === 0) {
      throw new Error("no_settlement_lines_inserted");
    }

    if (inserted.length < pending.length) {
      const adjustedGross = sumDecimal(inserted.map((x) => x.line.amount));
      const adjustedPlatformFee = sumDecimal(inserted.map((x) => x.platformFee));
      const adjustedNet = subtractDecimal(
        subtractDecimal(adjustedGross, adjustedPlatformFee),
        stripeFee,
      );
      await r.updateTotals(created.id, {
        grossAmount: adjustedGross,
        platformFee: adjustedPlatformFee,
        netAmount: adjustedNet,
      });
      const refreshed = (await r.findById(created.id)) ?? created;
      return {
        ok: true,
        payout: { ...refreshed, lines: inserted.map((x) => x.line) },
      };
    }

    return { ok: true, payout: { ...created, lines: inserted.map((x) => x.line) } };
  }

  async createSettlement(
    actorUserId: string | null,
    input: CreateSettlementInput,
  ): Promise<CreateSettlementResult> {
    const publisher = this.domainEventPublisher;
    if (!this.db || !publisher) {
      return await this.createSettlementCore(this.repo, input);
    }

    return await this.db.transaction(async (tx) => {
      const r = new DrizzlePayoutRepository(tx);
      const result = await this.createSettlementCore(r, input);
      if (!result.ok) {
        return result;
      }
      const source = actorUserId ? "admin" : "bulk_cron";
      await publisher.publish(tx, {
        aggregateType: "payout",
        aggregateId: result.payout.id,
        eventType: "payout.settlement_created",
        payload: {
          legalEntityId: input.legalEntityId,
          grossAmount: result.payout.grossAmount,
          platformFee: result.payout.platformFee,
          stripeFee: result.payout.stripeFee,
          netAmount: result.payout.netAmount,
          currency: result.payout.currency,
          paymentLineCount: result.payout.lines.length,
          periodStart: input.periodStart.toISOString(),
          periodEnd: input.periodEnd.toISOString(),
          source,
        },
        actorUserId: actorUserId,
        actingLegalEntityId: input.legalEntityId,
      });
      return result;
    });
  }

  async runBulkSettlement(
    actorUserId: string | null,
    opts?: { periodEnd?: Date },
  ): Promise<BulkPayoutSettlementResult> {
    const legalEntityIds = await this.repo.listLegalEntityIdsWithUnlinkedCapturedPayments();
    const periodEnd = opts?.periodEnd ?? new Date();
    const periodStart = new Date(0);
    const items: BulkPayoutSettlementResult["items"] = [];
    let createdCount = 0;

    for (const legalEntityId of legalEntityIds) {
      try {
        const result = await this.createSettlement(actorUserId, {
          legalEntityId,
          periodStart,
          periodEnd,
        });
        if (result.ok) {
          createdCount += 1;
          items.push({
            legalEntityId,
            outcome: "created",
            payoutId: result.payout.id,
          });
        } else {
          items.push({
            legalEntityId,
            outcome: "skipped",
            reason: result.reason,
          });
        }
      } catch (err) {
        items.push({
          legalEntityId,
          outcome: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { eligibleEntityCount: legalEntityIds.length, createdCount, items };
  }

  async runBulkSettlementWithTransfers(
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

    const legalEntityIds = await this.repo.listLegalEntityIdsWithUnlinkedCapturedPayments();

    for (const legalEntityId of legalEntityIds) {
      try {
        const result = await this.createSettlement(actorUserId, {
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

    const resumePayouts = await this.repo.listScheduledPayoutsAwaitingTransfer(1000);
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

  async addAdjustment(
    actorUserId: string,
    payoutId: string,
    input: CreatePayoutAdjustmentInput,
    kind: PayoutLineKind = "adjustment",
  ): Promise<PayoutWithLines> {
    const found = await this.repo.findById(payoutId);
    if (!found) throw new PayoutNotFoundError();
    if (found.status !== "scheduled" && found.status !== "in_transit") {
      throw new PayoutStatusTransitionError("cannot_adjust_payout_in_terminal_state");
    }

    await this.repo.insertLine({
      payoutId,
      paymentId: null,
      amount: input.amount,
      kind,
      createdByUserId: actorUserId,
      note: input.note,
    });

    if (this.payoutAdjustments) {
      await this.payoutAdjustments.recalculateTotalsFromLines(this.repo, payoutId);
    } else {
      const newGross = addDecimal(found.grossAmount, input.amount);
      const newNet = subtractDecimal(subtractDecimal(newGross, found.platformFee), found.stripeFee);
      await this.repo.updateTotals(payoutId, {
        grossAmount: newGross,
        platformFee: found.platformFee,
        netAmount: newNet,
      });
    }

    const updated = (await this.repo.findById(payoutId)) ?? found;
    const lines = await this.repo.listLines(payoutId);
    return { ...updated, lines };
  }

  async markPaid(actorUserId: string, payoutId: string, input: MarkPaidInput): Promise<Payout> {
    const publisher = this.domainEventPublisher;
    if (!this.db || !publisher) {
      const found = await this.repo.findById(payoutId);
      if (!found) throw new PayoutNotFoundError();
      if (found.status === "paid") {
        throw new PayoutStatusTransitionError("payout_already_paid");
      }
      if (found.status !== "scheduled" && found.status !== "in_transit") {
        throw new PayoutStatusTransitionError("cannot_pay_payout_in_state");
      }
      return await this.repo.updateStatus(payoutId, {
        status: "paid",
        stripeTransferId: input.stripeTransferId,
        processedAt: new Date(),
        failureReason: null,
      });
    }

    return await this.db.transaction(async (tx) => {
      const r = new DrizzlePayoutRepository(tx);
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
      await publisher.publish(tx, {
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

  async reconcileStripeTransfer(input: StripeTransferReconciliationInput): Promise<Payout | null> {
    const found = input.payoutId
      ? await this.repo.findById(input.payoutId)
      : await this.repo.findByStripeTransferId(input.stripeTransferId);
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

    const publisher = this.domainEventPublisher;
    if (!this.db || !publisher) {
      return await this.repo.reconcileStripeTransfer(found.id, patch);
    }

    return await this.db.transaction(async (tx) => {
      const r = new DrizzlePayoutRepository(tx);
      const row = await r.findById(found.id);
      if (!row) return null;
      const previousStatus = row.status;
      const updated = await r.reconcileStripeTransfer(row.id, patch);

      if (updated.status === "paid" && previousStatus !== "paid") {
        await publisher.publish(tx, {
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
        if (this.payoutAdjustments) {
          await this.payoutAdjustments.recalculateTotalsFromLines(r, updated.id);
        }

        await publisher.publish(tx, {
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

  async adminManualReverse(
    actorUserId: string,
    payoutId: string,
    input: { reason: string },
  ): Promise<Payout> {
    const publisher = this.domainEventPublisher;
    if (!this.db || !publisher) {
      const found = await this.repo.findById(payoutId);
      if (!found) throw new PayoutNotFoundError();
      if (found.status !== "paid" && found.status !== "in_transit") {
        throw new PayoutStatusTransitionError("cannot_reverse_payout_in_state");
      }
      return await this.repo.updateStatus(payoutId, {
        status: "reversed",
        failureReason: input.reason,
      });
    }

    return await this.db.transaction(async (tx) => {
      const r = new DrizzlePayoutRepository(tx);
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
      if (this.payoutAdjustments) {
        await this.payoutAdjustments.recalculateTotalsFromLines(r, found.id);
      }
      const updated = await r.updateStatus(payoutId, {
        status: "reversed",
        failureReason: input.reason,
      });
      await publisher.publish(tx, {
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
}
