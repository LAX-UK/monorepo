import type { Database } from "@auction/db";
import {
  domainEvent,
  legalEntity,
  payment,
  payout,
  payoutLine,
  privateSaleDeal,
  saleSellerTerms,
} from "@auction/db/schema";
import {
  TRANSFER_OUTCOME_UNKNOWN_PREFIX,
  dealPayoutAmounts,
  minorUnitsToMoneyString,
  parsePayoutSearch,
} from "@auction/domain";
import type {
  Payout,
  PayoutLine,
  PayoutLineKind,
  PayoutSellerTermsTotals,
  PayoutStatus,
} from "@auction/types";
import { type SQL, and, asc, desc, eq, isNotNull, isNull, ne, notLike, or, sql } from "drizzle-orm";
import type {
  CreatePayoutInput,
  IPayoutProcessorReader,
  IPayoutRepository,
  InsertPayoutLineInput,
  ListPayoutsFilter,
  PendingPaymentRow,
  ReconcileStripeTransferPatch,
  SellerClawbackFacts,
} from "../interfaces/payout.repository.js";
import { queryCreatedAtDailyCounts } from "./created-at-daily-count.query.js";
import { SALE_LINE_TERMS_COLUMNS, saleLinePaymentFacts } from "./sale-line-facts.js";
import { sellerTermsSnapshotFromRow } from "./seller-terms-row.js";

type PayoutRow = typeof payout.$inferSelect;
type PayoutLineRow = typeof payoutLine.$inferSelect;

function sellerTermsTotalsOf(row: PayoutRow): PayoutSellerTermsTotals | null {
  if (row.hammerAmount === null || row.commissionAmount === null) return null;
  if (row.commissionVatAmount === null) return null;
  return {
    hammer: String(row.hammerAmount),
    commission: String(row.commissionAmount),
    commissionVat: String(row.commissionVatAmount),
  };
}

/** The three seller-terms totals as stored: all set, or all empty. */
function sellerTermsTotalsColumns(totals: PayoutSellerTermsTotals | null | undefined) {
  return {
    hammerAmount: totals?.hammer ?? null,
    commissionAmount: totals?.commission ?? null,
    commissionVatAmount: totals?.commissionVat ?? null,
  };
}

function rowToPayout(row: PayoutRow): Payout {
  return {
    id: row.id,
    legalEntityId: row.legalEntityId,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    grossAmount: String(row.grossAmount),
    platformFee: String(row.platformFee),
    stripeFee: String(row.stripeFee),
    netAmount: String(row.netAmount),
    currency: row.currency,
    status: row.status as PayoutStatus,
    stripeTransferId: row.stripeTransferId ?? null,
    xeroBillId: row.xeroBillId ?? null,
    failureReason: row.failureReason ?? null,
    processedAt: row.processedAt ?? null,
    statementUrl: row.statementUrl ?? null,
    statementGenerationError: row.statementGenerationError ?? null,
    createdAt: row.createdAt,
    sellerTermsTotals: sellerTermsTotalsOf(row),
  };
}

function rowToLine(row: PayoutLineRow): PayoutLine {
  return {
    id: row.id,
    payoutId: row.payoutId,
    paymentId: row.paymentId ?? null,
    privateSaleDealId: row.privateSaleDealId ?? null,
    sellerTermsId: row.sellerTermsId ?? null,
    buyerRefundPence: row.buyerRefundPence ?? null,
    amount: String(row.amount),
    kind: row.kind as PayoutLineKind,
    createdByUserId: row.createdByUserId ?? null,
    note: row.note ?? null,
    createdAt: row.createdAt,
  };
}

/**
 * A deal's sale line splits like a lot's: the price, and the commission and agreed costs taken
 * from it, so the payout's totals and the statement add up the same way.
 */
function dealLineFacts(deal: {
  dealPriceMinor: number | null;
  dealCommissionBps: number | null;
  dealCostsMinor: number | null;
}): { amount: string; platformFee: string } | null {
  if (deal.dealPriceMinor === null || deal.dealCostsMinor === null) return null;
  const amounts = dealPayoutAmounts({
    priceMinor: deal.dealPriceMinor,
    sellerCommissionBps: deal.dealCommissionBps,
    costsMinor: deal.dealCostsMinor,
  });
  if (!amounts) return null;
  return {
    amount: minorUnitsToMoneyString(BigInt(amounts.grossMinor)),
    platformFee: minorUnitsToMoneyString(BigInt(amounts.deductionsMinor)),
  };
}

/**
 * The buyer refunds a payment's refund lines answered for, in pence, added up with their sign: a
 * line taking back a failed refund answers for a negative buyer refund and cancels the charge it
 * reverses. A line written before lines recorded it answered for its own amount, with its sign (a
 * charge was the buyer's refund, and a compensating line from a failed refund cancels it), as the
 * buyer's refund top-up reads it (0378).
 */
function refundLinesAnsweredSql(paymentId: SQL): SQL {
  return sql`COALESCE((
    SELECT SUM(COALESCE(pl.buyer_refund_pence, round(-pl.amount * 100)))
    FROM payout_line pl WHERE pl.payment_id = ${paymentId} AND pl.kind = 'refund'
  ), 0)`;
}

/**
 * A lot payment waiting for a payout run: captured, for more than nothing, on no payout yet, and
 * not LAX's own stock (whose proceeds are LAX's and are never paid out).
 */
function awaitingSettlement(): SQL {
  return sql`"payment"."status" = 'captured'
    AND ("payment"."amount")::numeric > 0
    AND NOT EXISTS (
      SELECT 1 FROM payout_line pl
      WHERE pl.payment_id = "payment"."id" AND pl.kind = 'sale'
    )
    AND NOT EXISTS (
      SELECT 1 FROM sale_seller_terms sst
      WHERE sst.payment_id = "payment"."id" AND sst.basis = 'lax_owned'
    )`;
}

/** Escapes `%`, `_` and `\\` so typed text is matched literally by LIKE. */
function likeLiteral(text: string): string {
  return text.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * The WHERE clause of the admin payout list. A search matches a payout reference
 * (`PO-YYYY-XXXXXXXX`: id prefix plus the year the period ends), the start of a payout id, or
 * the seller's name.
 */
function listWhere(filter: Omit<ListPayoutsFilter, "limit" | "offset">): SQL | undefined {
  const search = filter.search ? parsePayoutSearch(filter.search) : null;
  let searchCondition: SQL | undefined;
  if (search?.kind === "reference") {
    searchCondition = sql`${payout.id}::text like ${`${likeLiteral(search.idPrefix)}%`} and extract(year from ${payout.periodEnd} at time zone 'UTC') = ${search.year}`;
  } else if (search?.kind === "id") {
    searchCondition = sql`${payout.id}::text like ${`${likeLiteral(search.idPrefix)}%`}`;
  } else if (search?.kind === "text") {
    searchCondition = sql`${payout.legalEntityId} in (select ${legalEntity.id} from ${legalEntity} where ${legalEntity.displayName} ilike ${`%${likeLiteral(search.text)}%`})`;
  }
  const conditions = [
    filter.legalEntityId ? eq(payout.legalEntityId, filter.legalEntityId) : undefined,
    filter.status ? eq(payout.status, filter.status) : undefined,
    searchCondition,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export class DrizzlePayoutRepository implements IPayoutRepository, IPayoutProcessorReader {
  constructor(private readonly db: Database) {}

  async create(input: CreatePayoutInput): Promise<Payout> {
    const [row] = await this.db
      .insert(payout)
      .values({
        legalEntityId: input.legalEntityId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        grossAmount: input.grossAmount,
        platformFee: input.platformFee,
        stripeFee: input.stripeFee,
        netAmount: input.netAmount,
        currency: input.currency,
        status: "scheduled",
        ...sellerTermsTotalsColumns(input.sellerTermsTotals),
      })
      .returning();
    if (!row) throw new Error("payout_create_failed");
    return rowToPayout(row);
  }

  async insertLine(input: InsertPayoutLineInput): Promise<PayoutLine> {
    const [row] = await this.db
      .insert(payoutLine)
      .values({
        payoutId: input.payoutId,
        paymentId: input.paymentId,
        amount: input.amount,
        kind: input.kind,
        createdByUserId: input.createdByUserId,
        note: input.note,
        sourceEventId: input.sourceEventId ?? null,
        sellerTermsId: input.sellerTermsId ?? null,
        buyerRefundPence: input.buyerRefundPence ?? null,
      })
      .onConflictDoNothing()
      .returning();
    if (!row) {
      const existing = await this.db
        .select()
        .from(payoutLine)
        .where(
          and(
            eq(payoutLine.payoutId, input.payoutId),
            input.paymentId
              ? eq(payoutLine.paymentId, input.paymentId)
              : sql`${payoutLine.paymentId} IS NULL`,
            eq(payoutLine.kind, input.kind),
            input.sourceEventId
              ? eq(payoutLine.sourceEventId, input.sourceEventId)
              : sql`${payoutLine.sourceEventId} IS NULL`,
          ),
        )
        .limit(1);
      if (existing[0]) return rowToLine(existing[0]);
      throw new Error("payout_line_insert_failed");
    }
    return rowToLine(row);
  }

  async tryInsertSaleLine(input: InsertPayoutLineInput): Promise<PayoutLine | null> {
    try {
      return await this.insertLine(input);
    } catch {
      if (!input.paymentId || input.kind !== "sale") {
        throw new Error("payout_line_insert_failed");
      }
      const [linked] = await this.db
        .select()
        .from(payoutLine)
        .where(and(eq(payoutLine.paymentId, input.paymentId), eq(payoutLine.kind, "sale")))
        .limit(1);
      if (linked) {
        if (linked.payoutId === input.payoutId) return rowToLine(linked);
        return null;
      }
      throw new Error("payout_line_insert_failed");
    }
  }

  async list(filter: ListPayoutsFilter): Promise<Payout[]> {
    const where = listWhere(filter);
    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;

    // The seller's name comes with the row, so a list page never looks sellers up one by one.
    const base = this.db
      .select({ payout, legalEntityName: legalEntity.displayName })
      .from(payout)
      .leftJoin(legalEntity, eq(legalEntity.id, payout.legalEntityId));
    const rows = await (where ? base.where(where) : base)
      .orderBy(desc(payout.periodEnd))
      .limit(limit)
      .offset(offset);
    return rows.map((row) => ({
      ...rowToPayout(row.payout),
      legalEntityName: row.legalEntityName?.trim() || null,
    }));
  }

  async countMatching(filter: Omit<ListPayoutsFilter, "limit" | "offset">): Promise<number> {
    const where = listWhere(filter);
    const [row] = await (where
      ? this.db.select({ n: sql<number>`count(*)::int` }).from(payout).where(where)
      : this.db.select({ n: sql<number>`count(*)::int` }).from(payout));
    return row?.n ?? 0;
  }

  async summarizeMatching(
    filter: Omit<ListPayoutsFilter, "limit" | "offset">,
  ): Promise<import("../interfaces/payout.repository.js").AdminPayoutListSummary> {
    const where = listWhere(filter);

    const [row] = await (where
      ? this.db
          .select({
            total: sql<number>`count(*)::int`,
            scheduled: sql<number>`count(*) filter (where ${payout.status} = 'scheduled')::int`,
            inTransit: sql<number>`count(*) filter (where ${payout.status} = 'in_transit')::int`,
            paid: sql<number>`count(*) filter (where ${payout.status} = 'paid')::int`,
            failed: sql<number>`count(*) filter (where ${payout.status} = 'failed')::int`,
            reversed: sql<number>`count(*) filter (where ${payout.status} = 'reversed')::int`,
            clawbackPending: sql<number>`count(*) filter (where ${payout.status} = 'clawback_pending')::int`,
            transferBlocked: sql<number>`count(*) filter (where ${payout.status} = 'transfer_blocked')::int`,
            totalNet: sql<string>`coalesce(sum(${payout.netAmount})::text, '0')`,
            inFlightCount: sql<number>`count(*) filter (where ${payout.status} in ('scheduled', 'in_transit'))::int`,
            missingTransferRefCount: sql<number>`count(*) filter (where ${payout.status} in ('scheduled', 'in_transit') and (${payout.stripeTransferId} is null or btrim(${payout.stripeTransferId}) = ''))::int`,
            withFailureReasonCount: sql<number>`count(*) filter (where ${payout.failureReason} is not null and btrim(${payout.failureReason}) <> '')::int`,
            withStatementErrorCount: sql<number>`count(*) filter (where ${payout.statementGenerationError} is not null and btrim(${payout.statementGenerationError}) <> '')::int`,
            clawbackCount: sql<number>`count(*) filter (where ${payout.status} = 'clawback_pending')::int`,
            failedCount: sql<number>`count(*) filter (where ${payout.status} = 'failed')::int`,
            reversedCount: sql<number>`count(*) filter (where ${payout.status} = 'reversed')::int`,
            blockerPayoutCount: sql<number>`count(*) filter (where ${payout.failureReason} is not null or ${payout.statementGenerationError} is not null or ${payout.status} in ('clawback_pending', 'failed', 'reversed', 'transfer_blocked'))::int`,
          })
          .from(payout)
          .where(where)
      : this.db
          .select({
            total: sql<number>`count(*)::int`,
            scheduled: sql<number>`count(*) filter (where ${payout.status} = 'scheduled')::int`,
            inTransit: sql<number>`count(*) filter (where ${payout.status} = 'in_transit')::int`,
            paid: sql<number>`count(*) filter (where ${payout.status} = 'paid')::int`,
            failed: sql<number>`count(*) filter (where ${payout.status} = 'failed')::int`,
            reversed: sql<number>`count(*) filter (where ${payout.status} = 'reversed')::int`,
            clawbackPending: sql<number>`count(*) filter (where ${payout.status} = 'clawback_pending')::int`,
            transferBlocked: sql<number>`count(*) filter (where ${payout.status} = 'transfer_blocked')::int`,
            totalNet: sql<string>`coalesce(sum(${payout.netAmount})::text, '0')`,
            inFlightCount: sql<number>`count(*) filter (where ${payout.status} in ('scheduled', 'in_transit'))::int`,
            missingTransferRefCount: sql<number>`count(*) filter (where ${payout.status} in ('scheduled', 'in_transit') and (${payout.stripeTransferId} is null or btrim(${payout.stripeTransferId}) = ''))::int`,
            withFailureReasonCount: sql<number>`count(*) filter (where ${payout.failureReason} is not null and btrim(${payout.failureReason}) <> '')::int`,
            withStatementErrorCount: sql<number>`count(*) filter (where ${payout.statementGenerationError} is not null and btrim(${payout.statementGenerationError}) <> '')::int`,
            clawbackCount: sql<number>`count(*) filter (where ${payout.status} = 'clawback_pending')::int`,
            failedCount: sql<number>`count(*) filter (where ${payout.status} = 'failed')::int`,
            reversedCount: sql<number>`count(*) filter (where ${payout.status} = 'reversed')::int`,
            blockerPayoutCount: sql<number>`count(*) filter (where ${payout.failureReason} is not null or ${payout.statementGenerationError} is not null or ${payout.status} in ('clawback_pending', 'failed', 'reversed', 'transfer_blocked'))::int`,
          })
          .from(payout));

    const stats = row ?? {
      total: 0,
      scheduled: 0,
      inTransit: 0,
      paid: 0,
      failed: 0,
      reversed: 0,
      clawbackPending: 0,
      transferBlocked: 0,
      totalNet: "0",
      inFlightCount: 0,
      missingTransferRefCount: 0,
      withFailureReasonCount: 0,
      withStatementErrorCount: 0,
      clawbackCount: 0,
      failedCount: 0,
      reversedCount: 0,
      blockerPayoutCount: 0,
    };

    return {
      total: stats.total,
      scheduled: stats.scheduled,
      inTransit: stats.inTransit,
      paid: stats.paid,
      failed: stats.failed,
      reversed: stats.reversed,
      clawbackPending: stats.clawbackPending,
      transferBlocked: stats.transferBlocked,
      totalNet: stats.totalNet,
      readiness: {
        inFlightCount: stats.inFlightCount,
        missingTransferRefCount: stats.missingTransferRefCount,
        withFailureReasonCount: stats.withFailureReasonCount,
        withStatementErrorCount: stats.withStatementErrorCount,
        clawbackCount: stats.clawbackCount,
        failedCount: stats.failedCount,
        reversedCount: stats.reversedCount,
        blockerPayoutCount: stats.blockerPayoutCount,
      },
    };
  }

  async findById(payoutId: string): Promise<Payout | null> {
    const rows = await this.db.select().from(payout).where(eq(payout.id, payoutId)).limit(1);
    return rows[0] ? rowToPayout(rows[0]) : null;
  }

  async findByIdForUpdate(payoutId: string): Promise<Payout | null> {
    const rows = await this.db
      .select()
      .from(payout)
      .where(eq(payout.id, payoutId))
      .limit(1)
      .for("update");
    return rows[0] ? rowToPayout(rows[0]) : null;
  }

  async lockPayment(paymentId: string): Promise<void> {
    await this.db
      .select({ id: payment.id })
      .from(payment)
      .where(eq(payment.id, paymentId))
      .for("update");
  }

  async lockSettlementForEntity(legalEntityId: string): Promise<void> {
    await this.db.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`payout_settlement:${legalEntityId}`}))`,
    );
  }

  async lockPendingPayments(legalEntityId: string): Promise<string[]> {
    const rows = await this.db
      .select({ id: payment.id })
      .from(payment)
      .where(and(eq(payment.sellerLegalEntityId, legalEntityId), awaitingSettlement()))
      .orderBy(asc(payment.id))
      .for("update");
    const ids = rows.map((row) => row.id);
    // A refund the previous release handled has a payout line and no row in the buyer's refund
    // record until the backfill is run again. Copied now, under the lock, as the refund paths do,
    // it is part of what the run reads as refunded before payout.
    for (const id of ids) {
      await this.db.execute(sql`SELECT payment_refund_backfill_from_payout_lines(${id}::uuid)`);
    }
    return ids;
  }

  async updateXeroBillId(payoutId: string, xeroBillId: string): Promise<void> {
    await this.db.update(payout).set({ xeroBillId }).where(eq(payout.id, payoutId));
  }

  async findByStripeTransferId(stripeTransferId: string): Promise<Payout | null> {
    const rows = await this.db
      .select()
      .from(payout)
      .where(eq(payout.stripeTransferId, stripeTransferId))
      .limit(1);
    return rows[0] ? rowToPayout(rows[0]) : null;
  }

  async listProcessorUserIds(payoutId: string): Promise<string[]> {
    const actedOn = await this.db
      .selectDistinct({ userId: domainEvent.actorUserId })
      .from(domainEvent)
      .where(
        and(
          eq(domainEvent.aggregateType, "payout"),
          eq(domainEvent.aggregateId, payoutId),
          isNotNull(domainEvent.actorUserId),
          ne(domainEvent.eventType, "payout.reversed"),
        ),
      );
    const wroteLines = await this.db
      .selectDistinct({ userId: payoutLine.createdByUserId })
      .from(payoutLine)
      .where(
        and(
          eq(payoutLine.payoutId, payoutId),
          isNotNull(payoutLine.createdByUserId),
          ne(payoutLine.kind, "reversal"),
        ),
      );
    const ids = new Set<string>();
    for (const row of [...actedOn, ...wroteLines]) if (row.userId) ids.add(row.userId);
    return [...ids];
  }

  async listLines(payoutId: string): Promise<PayoutLine[]> {
    const rows = await this.db
      .select({
        line: payoutLine,
        paymentAmount: payment.amount,
        paymentPlatformFee: payment.platformFee,
        ...SALE_LINE_TERMS_COLUMNS,
        dealPriceMinor: privateSaleDeal.priceMinor,
        dealCommissionBps: privateSaleDeal.sellerCommissionBps,
        dealCostsMinor: privateSaleDeal.costsMinor,
      })
      .from(payoutLine)
      .leftJoin(payment, eq(payment.id, payoutLine.paymentId))
      .leftJoin(saleSellerTerms, eq(saleSellerTerms.id, payoutLine.sellerTermsId))
      .leftJoin(privateSaleDeal, eq(privateSaleDeal.id, payoutLine.privateSaleDealId))
      .where(eq(payoutLine.payoutId, payoutId))
      .orderBy(payoutLine.createdAt);
    return rows.map(({ line, dealPriceMinor, dealCommissionBps, dealCostsMinor, ...sale }) => ({
      ...rowToLine(line),
      payment:
        saleLinePaymentFacts(sale) ??
        dealLineFacts({ dealPriceMinor, dealCommissionBps, dealCostsMinor }),
    }));
  }

  async findUnlinkedCapturedPayments(legalEntityId: string): Promise<PendingPaymentRow[]> {
    const rows = await this.db
      .select({
        id: payment.id,
        amount: payment.amount,
        platformFee: payment.platformFee,
        capturedAt: payment.createdAt,
        lotId: payment.lotId,
        terms: saleSellerTerms,
        refundedPence: sql<string>`COALESCE((
          SELECT SUM(pr.amount_pence) FROM payment_refund pr
          WHERE pr.payment_id = "payment"."id" AND pr.currency = 'GBP'
        ), 0)::text`,
      })
      .from(payment)
      .leftJoin(saleSellerTerms, eq(saleSellerTerms.paymentId, payment.id))
      .where(and(eq(payment.sellerLegalEntityId, legalEntityId), awaitingSettlement()))
      .orderBy(payment.createdAt);

    return rows.map((r) => ({
      id: r.id,
      amount: String(r.amount),
      platformFee: String(r.platformFee),
      capturedAt: r.capturedAt,
      lotId: r.lotId ?? null,
      sellerTerms: r.terms
        ? { id: r.terms.id, snapshot: sellerTermsSnapshotFromRow(r.terms) }
        : null,
      refundedPence: Number(r.refundedPence),
    }));
  }

  async listLegalEntityIdsWithUnlinkedCapturedPayments(): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ legalEntityId: payment.sellerLegalEntityId })
      .from(payment)
      .where(and(isNotNull(payment.sellerLegalEntityId), awaitingSettlement()));
    return rows
      .map((r) => r.legalEntityId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
  }

  async listScheduledPayoutsAwaitingTransfer(limit = 1000): Promise<Payout[]> {
    const rows = await this.db
      .select()
      .from(payout)
      .where(
        and(
          eq(payout.status, "scheduled"),
          sql`${payout.stripeTransferId} IS NULL`,
          sql`(${payout.netAmount})::numeric > 0`,
        ),
      )
      .orderBy(desc(payout.createdAt))
      .limit(limit);
    return rows.map(rowToPayout);
  }

  async updateTotals(
    payoutId: string,
    totals: {
      grossAmount: string;
      platformFee: string;
      netAmount: string;
      sellerTermsTotals?: PayoutSellerTermsTotals | null;
    },
  ): Promise<Payout> {
    const [row] = await this.db
      .update(payout)
      .set({
        grossAmount: totals.grossAmount,
        platformFee: totals.platformFee,
        netAmount: totals.netAmount,
        // Left out, the totals of the sales on the payout stay as they are.
        ...(totals.sellerTermsTotals !== undefined
          ? sellerTermsTotalsColumns(totals.sellerTermsTotals)
          : {}),
      })
      .where(eq(payout.id, payoutId))
      .returning();
    if (!row) throw new Error("payout_update_totals_failed");
    return rowToPayout(row);
  }

  async updateStatus(
    payoutId: string,
    patch: {
      status: Payout["status"];
      stripeTransferId?: string | null;
      processedAt?: Date | null;
      failureReason?: string | null;
    },
  ): Promise<Payout> {
    const updateValues: {
      status: PayoutStatus;
      stripeTransferId?: string | null;
      processedAt?: Date | null;
      failureReason?: string | null;
    } = { status: patch.status as PayoutStatus };
    if (patch.stripeTransferId !== undefined) {
      updateValues.stripeTransferId = patch.stripeTransferId;
    }
    if (patch.processedAt !== undefined) {
      updateValues.processedAt = patch.processedAt;
    }
    if (patch.failureReason !== undefined) {
      updateValues.failureReason = patch.failureReason;
    }
    const [row] = await this.db
      .update(payout)
      .set(updateValues)
      .where(eq(payout.id, payoutId))
      .returning();
    if (!row) throw new Error("payout_update_status_failed");
    return rowToPayout(row);
  }

  async updateStatusIfCurrent(
    payoutId: string,
    expectedStatus: Payout["status"],
    patch: {
      status: Payout["status"];
      stripeTransferId?: string | null;
      processedAt?: Date | null;
      failureReason?: string | null;
    },
  ): Promise<Payout | null> {
    const updateValues: {
      status: PayoutStatus;
      stripeTransferId?: string | null;
      processedAt?: Date | null;
      failureReason?: string | null;
    } = { status: patch.status as PayoutStatus };
    if (patch.stripeTransferId !== undefined) {
      updateValues.stripeTransferId = patch.stripeTransferId;
    }
    if (patch.processedAt !== undefined) {
      updateValues.processedAt = patch.processedAt;
    }
    if (patch.failureReason !== undefined) {
      updateValues.failureReason = patch.failureReason;
    }
    const [row] = await this.db
      .update(payout)
      .set(updateValues)
      .where(and(eq(payout.id, payoutId), eq(payout.status, expectedStatus as PayoutStatus)))
      .returning();
    return row ? rowToPayout(row) : null;
  }

  async reconcileStripeTransfer(
    payoutId: string,
    patch: ReconcileStripeTransferPatch,
  ): Promise<Payout> {
    const updateValues: {
      status: PayoutStatus;
      stripeTransferId: string;
      stripeFee?: string;
      netAmount?: string;
      processedAt?: Date | null;
      failureReason?: string | null;
    } = {
      status: patch.status as PayoutStatus,
      stripeTransferId: patch.stripeTransferId,
    };

    if (patch.processedAt !== undefined) updateValues.processedAt = patch.processedAt;
    if (patch.failureReason !== undefined) updateValues.failureReason = patch.failureReason;

    if (patch.stripeFee !== undefined) {
      updateValues.stripeFee = patch.stripeFee;
      updateValues.netAmount =
        sql`${payout.grossAmount} - ${payout.platformFee} - ${patch.stripeFee}` as unknown as string;
    }

    const [row] = await this.db
      .update(payout)
      .set(updateValues)
      .where(eq(payout.id, payoutId))
      .returning();
    if (!row) throw new Error("payout_reconcile_transfer_failed");
    return rowToPayout(row);
  }

  async setStatementUrl(payoutId: string, statementUrl: string): Promise<void> {
    await this.db
      .update(payout)
      .set({ statementUrl, statementGenerationError: null })
      .where(eq(payout.id, payoutId));
  }

  async setStatementGenerationError(payoutId: string, message: string): Promise<void> {
    await this.db
      .update(payout)
      .set({ statementGenerationError: message })
      .where(eq(payout.id, payoutId));
  }

  async clearStatementGenerationError(payoutId: string): Promise<void> {
    await this.db
      .update(payout)
      .set({ statementGenerationError: null })
      .where(eq(payout.id, payoutId));
  }

  async findOpenPayoutForEntity(legalEntityId: string): Promise<Payout | null> {
    const rows = await this.db
      .select()
      .from(payout)
      .where(
        and(
          eq(payout.legalEntityId, legalEntityId),
          // Only a payout whose transfer has not started can take new lines: once the transfer
          // amount is read, a line would change the record but not the money sent. The same holds
          // after an attempt whose outcome is unknown, as Stripe may hold a transfer for the amount
          // it read (see `payoutTakesLines`).
          eq(payout.status, "scheduled"),
          or(
            isNull(payout.failureReason),
            notLike(payout.failureReason, `${TRANSFER_OUTCOME_UNKNOWN_PREFIX}%`),
          ),
        ),
      )
      .orderBy(desc(payout.periodEnd))
      .limit(1);
    return rows[0] ? rowToPayout(rows[0]) : null;
  }

  async lineExistsForSourceEvent(sourceEventId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: payoutLine.id })
      .from(payoutLine)
      .where(eq(payoutLine.sourceEventId, sourceEventId))
      .limit(1);
    return rows.length > 0;
  }

  async sumRefundLineCentsForPayment(paymentId: string): Promise<number> {
    // A sale on no payout owes the seller nothing back, so the seller's side has dealt with every
    // buyer refund recorded for it. Once it is paid out, the refund lines say what they answered for.
    const result = await this.db.execute<{ total: string }>(sql`
      SELECT (CASE
        WHEN EXISTS (
          SELECT 1 FROM payout_line pl WHERE pl.payment_id = ${paymentId} AND pl.kind = 'sale'
        ) THEN ${refundLinesAnsweredSql(sql`${paymentId}::uuid`)}
        ELSE COALESCE((
          SELECT SUM(pr.amount_pence) FROM payment_refund pr
          WHERE pr.payment_id = ${paymentId} AND pr.currency = 'GBP'
        ), 0)
      END)::text AS total
    `);
    return Number(result.rows[0]?.total ?? "0");
  }

  async findSellerClawbackFacts(paymentId: string): Promise<SellerClawbackFacts> {
    // The subqueries name the payment row in full: in a select list a bare column is ambiguous.
    const [row] = await this.db
      .select({
        paymentAmount: payment.amount,
        saleLineId: sql<string | null>`(
          SELECT pl.id FROM payout_line pl
          WHERE pl.payment_id = "payment"."id" AND pl.kind = 'sale' LIMIT 1
        )`,
        sellerNetPence: sql<string | null>`(
          SELECT sst.seller_net_pence::text FROM payout_line pl
          JOIN sale_seller_terms sst ON sst.id = pl.seller_terms_id
          WHERE pl.payment_id = "payment"."id" AND pl.kind = 'sale' LIMIT 1
        )`,
        // Every line with its sign: a charge takes money back, and a credit (the run's true-up of
        // a charge made in full, or a failed refund given back) cancels part of one.
        clawedBackPence: sql<string>`COALESCE((
          SELECT SUM(round(-pl.amount * 100)) FROM payout_line pl
          WHERE pl.payment_id = "payment"."id" AND pl.kind = 'refund'
        ), 0)::text`,
        buyerRefundAnsweredPence: sql<string>`(${refundLinesAnsweredSql(sql`"payment"."id"`)})::text`,
      })
      .from(payment)
      .where(eq(payment.id, paymentId))
      .limit(1);
    if (!row) throw new Error(`payment ${paymentId} not found`);
    const paidOut: SellerClawbackFacts["paidOut"] =
      row.saleLineId === null
        ? { kind: "not_paid_out" }
        : row.sellerNetPence === null
          ? { kind: "old_rule" }
          : { kind: "snapshot", sellerNetPence: Number(row.sellerNetPence) };
    return {
      paymentPence: Math.round(Number.parseFloat(String(row.paymentAmount)) * 100),
      paidOut,
      clawedBackPence: Number(row.clawedBackPence),
      buyerRefundAnsweredPence: Number(row.buyerRefundAnsweredPence),
    };
  }

  async findLineForPaymentAndKind(
    payoutId: string,
    paymentId: string,
    kind: PayoutLineKind,
  ): Promise<PayoutLine | null> {
    const rows = await this.db
      .select()
      .from(payoutLine)
      .where(
        and(
          eq(payoutLine.payoutId, payoutId),
          eq(payoutLine.paymentId, paymentId),
          eq(payoutLine.kind, kind),
        ),
      )
      .limit(1);
    return rows[0] ? rowToLine(rows[0]) : null;
  }

  async updateLineAmount(
    lineId: string,
    amount: string,
    sourceEventId?: string | null,
    buyerRefundPence?: number | null,
  ): Promise<PayoutLine> {
    const [row] = await this.db
      .update(payoutLine)
      .set({
        amount,
        ...(sourceEventId !== undefined ? { sourceEventId } : {}),
        ...(buyerRefundPence !== undefined ? { buyerRefundPence } : {}),
      })
      .where(eq(payoutLine.id, lineId))
      .returning();
    if (!row) throw new Error("payout_line_update_failed");
    return rowToLine(row);
  }

  async countCreatedAtByDay(rangeStart: Date): Promise<Map<string, number>> {
    return queryCreatedAtDailyCounts(this.db, payout, payout.createdAt, rangeStart);
  }
}
