import type { IPayoutRepository } from "@auction/persistence/interfaces";
import type { PayoutLine } from "@auction/types";
import { subtractDecimal, sumDecimal } from "../decimal-money.js";
import {
  DEFAULT_CURRENCY,
  type PayoutSettlementDeps,
  settlementAmounts,
} from "./payout-helpers.js";
import type { CreateSettlementInput, CreateSettlementResult } from "./types.js";
import type { BulkPayoutSettlementResult } from "./types.js";

export async function createSettlementCore(
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

export async function createSettlement(
  deps: PayoutSettlementDeps,
  actorUserId: string | null,
  input: CreateSettlementInput,
): Promise<CreateSettlementResult> {
  const publisher = deps.domainEventSink;
  if (!deps.transactionRunner || !publisher) {
    return await createSettlementCore(deps.repo, input);
  }

  return await deps.transactionRunner.runInTransaction(async (tx) => {
    const r = deps.payoutRepoForTx(tx);
    const result = await createSettlementCore(r, input);
    if (!result.ok) {
      return result;
    }
    const source = actorUserId ? "admin" : "bulk_cron";
    await publisher.withTx(tx).publish({
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

export async function runBulkSettlement(
  deps: PayoutSettlementDeps,
  actorUserId: string | null,
  opts?: { periodEnd?: Date },
): Promise<BulkPayoutSettlementResult> {
  const legalEntityIds = await deps.repo.listLegalEntityIdsWithUnlinkedCapturedPayments();
  const periodEnd = opts?.periodEnd ?? new Date();
  const periodStart = new Date(0);
  const items: BulkPayoutSettlementResult["items"] = [];
  let createdCount = 0;

  for (const legalEntityId of legalEntityIds) {
    try {
      const result = await createSettlement(deps, actorUserId, {
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
