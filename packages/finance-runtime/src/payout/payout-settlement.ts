import {
  PRIVATE_SALE_DEAL_EVENT_AGGREGATE,
  type PayoutLineFacts,
  dealPayoutAmounts,
  minorUnitsToMoneyString,
  payoutTotals,
} from "@auction/domain";
import type {
  IPayoutRepository,
  IPrivateSaleDealPayoutStore,
} from "@auction/persistence/interfaces";
import type { PayoutLine, PrivateSalePayoutDeal } from "@auction/types";
import {
  DEFAULT_CURRENCY,
  type PayoutSettlementDeps,
  listSettlementEntityIds,
  settlementAmounts,
} from "./payout-helpers.js";
import type { CreateSettlementInput, CreateSettlementResult } from "./types.js";
import type { BulkPayoutSettlementResult } from "./types.js";

/** A deal queued on the payout, so the run can tell the deal it is on its way. */
export type QueuedDealPayout = { dealId: string; reference: string; netToSellerMinor: number };

export type CreatedSettlementResult = CreateSettlementResult & {
  /** The deals this payout settles; empty for a payout of lot payments only. */
  queuedDeals?: QueuedDealPayout[];
};

/** A released deal as a payout line: the price, split like a lot's into commission and costs. */
function dealLine(deal: PrivateSalePayoutDeal) {
  const amounts = dealPayoutAmounts({
    priceMinor: deal.priceMinor,
    sellerCommissionBps: deal.sellerCommissionBps,
    costsMinor: deal.costsMinor,
  });
  if (!amounts) return null;
  const gross = minorUnitsToMoneyString(BigInt(amounts.grossMinor));
  const facts: PayoutLineFacts = {
    kind: "sale",
    amount: gross,
    payment: {
      amount: gross,
      platformFee: minorUnitsToMoneyString(BigInt(amounts.deductionsMinor)),
    },
  };
  return { gross, facts, netMinor: amounts.netMinor };
}

export async function createSettlementCore(
  r: IPayoutRepository,
  input: CreateSettlementInput,
  deals?: IPrivateSaleDealPayoutStore | null,
): Promise<CreatedSettlementResult> {
  const pending = await r.findUnlinkedCapturedPayments(input.legalEntityId);
  const pendingDeals = (await deals?.findUnsettledReleased(input.legalEntityId)) ?? [];
  if (pending.length === 0 && pendingDeals.length === 0) {
    return { ok: false, reason: "no_pending_payments" };
  }

  const settled = pending.map((p) => ({ ...p, ...settlementAmounts(p) }));
  const stripeFee = "0.00";
  // Stored totals are the lines added up with the split the payout page shows.
  const saleLine = (p: (typeof pending)[number], saleAmount: string): PayoutLineFacts => ({
    kind: "sale",
    amount: saleAmount,
    payment: { amount: p.amount, platformFee: p.platformFee },
  });
  const dealLines = pendingDeals.flatMap((deal) => {
    const line = dealLine(deal);
    return line ? [{ deal, ...line }] : [];
  });
  const initial = payoutTotals(
    [
      ...pending.map((p, i) => saleLine(p, settled[i]?.saleAmount ?? p.amount)),
      ...dealLines.map((d) => d.facts),
    ],
    stripeFee,
  );
  const { gross: grossAmount, platformFee, net: netAmount } = initial;

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

  const inserted: { line: PayoutLine; facts: PayoutLineFacts }[] = [];
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
      const original = pending.find((x) => x.id === p.id);
      inserted.push({ line, facts: saleLine(original ?? p, p.saleAmount) });
    }
  }
  const queuedDeals: QueuedDealPayout[] = [];
  for (const d of dealLines) {
    const line = await deals?.insertSaleLine({
      payoutId: created.id,
      dealId: d.deal.dealId,
      amount: d.gross,
    });
    if (line) {
      inserted.push({ line, facts: d.facts });
      queuedDeals.push({
        dealId: d.deal.dealId,
        reference: d.deal.reference,
        netToSellerMinor: d.netMinor,
      });
    }
  }

  if (inserted.length === 0) {
    throw new Error("no_settlement_lines_inserted");
  }

  if (inserted.length < pending.length + dealLines.length) {
    const adjusted = payoutTotals(
      inserted.map((x) => x.facts),
      stripeFee,
    );
    await r.updateTotals(created.id, {
      grossAmount: adjusted.gross,
      platformFee: adjusted.platformFee,
      netAmount: adjusted.net,
    });
    const refreshed = (await r.findById(created.id)) ?? created;
    return {
      ok: true,
      payout: { ...refreshed, lines: inserted.map((x) => x.line) },
      queuedDeals,
    };
  }

  return { ok: true, payout: { ...created, lines: inserted.map((x) => x.line) }, queuedDeals };
}

export async function createSettlement(
  deps: PayoutSettlementDeps,
  actorUserId: string | null,
  input: CreateSettlementInput,
): Promise<CreateSettlementResult> {
  const publisher = deps.domainEventSink;
  if (!deps.transactionRunner || !publisher) {
    throw new Error("payout_transactions_not_configured");
  }

  return await deps.transactionRunner.runInTransaction(async (tx) => {
    const r = deps.payoutRepoForTx(tx);
    // One settlement per legal entity at a time: a concurrent run waits here, then sees the
    // payments already on the first payout and finds nothing pending.
    await r.lockSettlementForEntity(input.legalEntityId);
    const result = await createSettlementCore(r, input, deps.dealPayoutsForTx?.(tx) ?? null);
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
    for (const deal of result.queuedDeals ?? []) {
      await publisher.withTx(tx).publish({
        aggregateType: PRIVATE_SALE_DEAL_EVENT_AGGREGATE,
        aggregateId: deal.dealId,
        eventType: "private_sale_deal.payout_queued",
        payload: {
          dealId: deal.dealId,
          reference: deal.reference,
          payoutId: result.payout.id,
          netToSellerMinor: deal.netToSellerMinor,
        },
        actorUserId: null,
        actingLegalEntityId: input.legalEntityId,
      });
    }
    return result;
  });
}

export async function runBulkSettlement(
  deps: PayoutSettlementDeps,
  actorUserId: string | null,
  opts?: { periodEnd?: Date },
): Promise<BulkPayoutSettlementResult> {
  const legalEntityIds = await listSettlementEntityIds(deps);
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
