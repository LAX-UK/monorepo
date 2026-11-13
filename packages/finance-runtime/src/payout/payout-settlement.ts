import {
  type HeldSettlementSale,
  PRIVATE_SALE_DEAL_EVENT_AGGREGATE,
  type PayableSellerTerms,
  type PayoutLineFacts,
  type SellerTermsTotals,
  type SettlementSale,
  dealPayoutAmounts,
  minorUnitsToMoneyString,
  payoutTotals,
  resolveSettlementPeriod,
  sellerRefundChargeAtPayout,
  sellerTermsTotals,
  snapshotSaleLine,
} from "@auction/domain";
import type {
  IPayoutRepository,
  IPrivateSaleDealPayoutStore,
  PendingPaymentRow,
} from "@auction/persistence/interfaces";
import type { PayoutLine, PrivateSalePayoutDeal } from "@auction/types";
import {
  DEFAULT_CURRENCY,
  type PayoutSettlementDeps,
  listSettlementEntityIds,
} from "./payout-helpers.js";
import type { ISettlementSellerTerms } from "./settlement-seller-terms.js";
import type {
  BulkPayoutSettlementResult,
  CreateSettlementInput,
  CreateSettlementResult,
  ResolvedSettlementInput,
} from "./types.js";

/** A deal queued on the payout, so the run can tell the deal it is on its way. */
export type QueuedDealPayout = { dealId: string; reference: string; netToSellerMinor: number };

/** A lot sale the payout pays, with the snapshot it pays from. */
export type SettledSale = {
  paymentId: string;
  sellerTermsId: string;
  terms: PayableSellerTerms;
};

export type CreatedSettlementResult = CreateSettlementResult & {
  /** The deals this payout settles; empty for a payout of lot payments only. */
  queuedDeals?: QueuedDealPayout[];
  /** The lot sales this payout pays, each from its seller-terms snapshot. */
  settledSales?: SettledSale[];
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

const pounds = (pence: number) => minorUnitsToMoneyString(BigInt(pence));

/** The note on a refund line the run adds for a part refund the buyer had before the payout. */
export const REFUND_BEFORE_PAYOUT_NOTE = "Part refund to the buyer before this payout";
/**
 * The note on the line that gives back what an earlier release charged for a part refund before
 * payout beyond the seller's share of it.
 */
export const REFUND_TRUE_UP_NOTE =
  "Part refund before this payout: the charge made in full before the agreement rule, less the seller's share";

/**
 * The buyer's refunds before the sale was paid out, settled as the run pays the sale: the seller's
 * share of them, by the same rule a refund after payout follows, less what is already on the
 * seller's ledger for them. `null` when there is nothing to record. A charge made in full under the
 * old rule before this release is brought back to the share here, so the line can be a credit.
 */
async function refundBeforePayout(
  r: IPayoutRepository,
  pending: PendingPaymentRow,
  terms: PayableSellerTerms,
): Promise<{
  facts: PayoutLineFacts;
  chargePence: number;
  buyerRefundPence: number;
  note: string;
} | null> {
  // A refund line from the previous release is copied to the buyer's record (migration 0344's
  // backfill), so a sale with nothing refunded on that record has nothing on the ledger either.
  if (pending.refundedPence <= 0) return null;
  const facts = await r.findSellerClawbackFacts(pending.id);
  const charge = sellerRefundChargeAtPayout({
    sellerNetPence: terms.sellerNetPence,
    paymentPence: facts.paymentPence,
    buyerRefundedPence: pending.refundedPence,
    clawedBackPence: facts.clawedBackPence,
    buyerRefundAnsweredPence: facts.buyerRefundAnsweredPence,
  });
  if (!charge) return null;
  return {
    facts: { kind: "refund", amount: pounds(-charge.chargePence) },
    chargePence: charge.chargePence,
    buyerRefundPence: charge.buyerRefundPence,
    note: charge.chargePence < 0 ? REFUND_TRUE_UP_NOTE : REFUND_BEFORE_PAYOUT_NOTE,
  };
}

const heldOf = (sales: readonly SettlementSale[]): HeldSettlementSale[] =>
  sales.flatMap((sale) =>
    sale.kind === "held"
      ? [{ paymentId: sale.paymentId, lotId: sale.lotId, reason: sale.reason }]
      : [],
  );

/**
 * One payout for a seller: every captured sale paid from its seller-terms snapshot (the hammer,
 * less the agreement's commission and the VAT on it), and every released deal. A sale whose terms
 * are held is left out with its reason and the rest are paid; LAX's own stock is never paid out.
 * The stored totals are the lines added up, and the hammer, commission and VAT totals are kept
 * beside them.
 */
export async function createSettlementCore(
  r: IPayoutRepository,
  input: ResolvedSettlementInput,
  deals: IPrivateSaleDealPayoutStore | null,
  sellerTerms: ISettlementSellerTerms,
): Promise<CreatedSettlementResult> {
  const pending = await r.findUnlinkedCapturedPayments(input.legalEntityId);
  const pendingDeals = (await deals?.findUnsettledReleased(input.legalEntityId)) ?? [];
  // One at a time: each sale's terms are read and stored through the run's transaction.
  const sales: SettlementSale[] = [];
  for (const p of pending) sales.push(await sellerTerms.forRun(p, input.legalEntityId));
  const heldSales = heldOf(sales);
  const ready = sales.flatMap((sale) => (sale.kind === "ready" ? [sale] : []));
  if (ready.length === 0 && pendingDeals.length === 0) {
    return { ok: false, reason: "no_pending_payments", heldSales };
  }

  const byPayment = new Map(pending.map((p) => [p.id, p]));
  const saleLines = [];
  for (const sale of ready) {
    const payment = byPayment.get(sale.paymentId);
    if (!payment) continue;
    saleLines.push({
      sale,
      line: snapshotSaleLine(sale.terms),
      refund: await refundBeforePayout(r, payment, sale.terms),
    });
  }
  const dealLines = pendingDeals.flatMap((deal) => {
    const line = dealLine(deal);
    return line ? [{ deal, ...line }] : [];
  });

  const stripeFee = "0.00";
  const totalsOf = (lineFacts: PayoutLineFacts[], paid: readonly PayableSellerTerms[]) => ({
    ...payoutTotals(lineFacts, stripeFee),
    sellerTerms: paid.length > 0 ? sellerTermsTotals(paid) : null,
  });
  const initial = totalsOf(
    [
      ...saleLines.flatMap((s) => (s.refund ? [s.line.facts, s.refund.facts] : [s.line.facts])),
      ...dealLines.map((d) => d.facts),
    ],
    saleLines.map((s) => s.sale.terms),
  );

  const created = await r.create({
    legalEntityId: input.legalEntityId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    grossAmount: initial.gross,
    platformFee: initial.platformFee,
    stripeFee,
    netAmount: initial.net,
    currency: DEFAULT_CURRENCY,
    sellerTermsTotals: initial.sellerTerms,
  });

  const inserted: { line: PayoutLine; facts: PayoutLineFacts }[] = [];
  const settledSales: SettledSale[] = [];
  for (const { sale, line, refund } of saleLines) {
    const saleLine = await r.tryInsertSaleLine({
      payoutId: created.id,
      paymentId: sale.paymentId,
      amount: line.amount,
      kind: "sale",
      createdByUserId: null,
      note: null,
      sellerTermsId: sale.sellerTermsId,
    });
    // Another run paid this sale first: it is on that payout, not this one.
    if (!saleLine) continue;
    inserted.push({ line: saleLine, facts: line.facts });
    settledSales.push({
      paymentId: sale.paymentId,
      sellerTermsId: sale.sellerTermsId,
      terms: sale.terms,
    });
    if (refund) {
      const refundLine = await r.insertLine({
        payoutId: created.id,
        paymentId: sale.paymentId,
        amount: refund.facts.amount,
        kind: "refund",
        createdByUserId: null,
        note: refund.note,
        buyerRefundPence: refund.buyerRefundPence,
      });
      inserted.push({ line: refundLine, facts: refund.facts });
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

  const result = { ok: true as const, queuedDeals, heldSales, settledSales };
  const expected = saleLines.reduce((n, s) => n + (s.refund ? 2 : 1), 0) + dealLines.length;
  if (inserted.length < expected) {
    const adjusted = totalsOf(
      inserted.map((x) => x.facts),
      settledSales.map((s) => s.terms),
    );
    await r.updateTotals(created.id, {
      grossAmount: adjusted.gross,
      platformFee: adjusted.platformFee,
      netAmount: adjusted.net,
      sellerTermsTotals: adjusted.sellerTerms,
    });
    const refreshed = (await r.findById(created.id)) ?? created;
    return { ...result, payout: { ...refreshed, lines: inserted.map((x) => x.line) } };
  }

  return { ...result, payout: { ...created, lines: inserted.map((x) => x.line) } };
}

/**
 * Each sale on the payout as the accounts read it, so nothing downstream works the split out
 * again: the hammer, the agreement's commission and the VAT on it, and what the seller receives.
 */
function settledSaleLines(sales: readonly SettledSale[]) {
  return sales.map(({ paymentId, sellerTermsId, terms }) => ({
    paymentId,
    lotId: terms.lotId,
    sellerTermsId,
    agreementId: terms.agreementId,
    hammerPence: terms.hammerPence,
    commissionBps: terms.commissionBps,
    commissionPence: terms.commissionPence,
    commissionVatTreatment: terms.commissionVatTreatment,
    commissionVatBps: terms.commissionVatBps,
    commissionVatPence: terms.commissionVatPence,
    sellerNetPence: terms.sellerNetPence,
  }));
}

function sellerTermsPayload(totals: SellerTermsTotals | null | undefined) {
  return totals
    ? {
        hammerAmount: totals.hammer,
        commissionAmount: totals.commission,
        commissionVatAmount: totals.commissionVat,
      }
    : {};
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
    // Then the rows of the payments it may pay, so what was refunded on each is read once no
    // refund of them is in flight: a refund that started first is committed and seen below (and
    // charged as the run pays the sale); one that starts now waits until the sale line is in place
    // and charges the seller as a refund after payout. Refunds take only the payment row and never
    // this run's advisory lock, so the order (advisory, then payment) cannot deadlock with them.
    await r.lockPendingPayments(input.legalEntityId);
    // The period is read here, under the lock and through this transaction, so the settled period
    // another run just wrote is already visible and the two cannot overlap.
    const [latest] = await r.list({ legalEntityId: input.legalEntityId, limit: 1 });
    const waiting = await r.findUnlinkedCapturedPayments(input.legalEntityId);
    const period = resolveSettlementPeriod({
      now: input.periodEnd,
      requestedStart: input.periodStart,
      lastSettledEnd: latest?.periodEnd ?? null,
      earliestPending: waiting.reduce<Date | null>(
        (oldest, p) => (p.capturedAt && (!oldest || p.capturedAt < oldest) ? p.capturedAt : oldest),
        null,
      ),
    });
    if (!period.ok) return period;
    const resolved: ResolvedSettlementInput = {
      legalEntityId: input.legalEntityId,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      ...(input.reason !== undefined ? { reason: input.reason } : {}),
    };
    const result = await createSettlementCore(
      r,
      resolved,
      deps.dealPayoutsForTx?.(tx) ?? null,
      deps.sellerTermsForTx(tx),
    );
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
        periodStart: resolved.periodStart.toISOString(),
        periodEnd: resolved.periodEnd.toISOString(),
        source,
        ...(input.reason !== undefined ? { reason: input.reason } : {}),
        ...sellerTermsPayload(result.payout.sellerTermsTotals),
        sales: settledSaleLines(result.settledSales ?? []),
        heldSales: result.heldSales ?? [],
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
  const items: BulkPayoutSettlementResult["items"] = [];
  let createdCount = 0;

  for (const legalEntityId of legalEntityIds) {
    try {
      const result = await createSettlement(deps, actorUserId, { legalEntityId, periodEnd });
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
