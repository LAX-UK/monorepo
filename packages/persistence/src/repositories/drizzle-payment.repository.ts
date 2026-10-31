import type { Database } from "@auction/db";
import {
  bidIdentityDirectory,
  lot,
  lotFulfilment,
  payment,
  paymentExternalRef,
  sale,
} from "@auction/db/schema";
import { and, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import type { InferSelectModel, SQL } from "drizzle-orm";
import type {
  AdminPaymentTableRowDto,
  AdminPaymentsDailyAmounts,
  AdminPaymentsSummaryStats,
  CreatePaymentRow,
  IPaymentWriteRepository,
  ListPaymentsAdminTableFilter,
  ListPaymentsExportFilter,
  PaymentRecord,
} from "../interfaces/payment-write.repository.js";
import { queryCreatedAtDailyCounts } from "./created-at-daily-count.query.js";

type Row = InferSelectModel<typeof payment>;

function exportWhere(filter: ListPaymentsExportFilter) {
  const conditions = [];
  if (filter.manualReview === true) {
    conditions.push(eq(payment.status, "requires_manual_review"));
  } else if (filter.status) {
    conditions.push(eq(payment.status, filter.status));
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

/** Exported for tests. `payment.id` is a uuid and the fulfilment status an enum, so both are cast to text before `ilike`. */
export function adminTableWhere(filter: Omit<ListPaymentsAdminTableFilter, "limit" | "offset">) {
  const conditions = [];
  if (filter.status) {
    conditions.push(eq(payment.status, filter.status));
  }
  if (filter.fulfilmentStatuses && filter.fulfilmentStatuses.length > 0) {
    conditions.push(inArray(sql`${lotFulfilment.status}::text`, [...filter.fulfilmentStatuses]));
  }
  if (filter.xeroInvoice === "linked") {
    conditions.push(isNotNull(paymentExternalRef.xeroInvoiceNumber));
  } else if (filter.xeroInvoice === "missing") {
    conditions.push(isNull(paymentExternalRef.xeroInvoiceNumber));
  } else if (filter.xeroInvoice === "sync_error") {
    conditions.push(eq(paymentExternalRef.syncStatus, "error"));
  }
  const needle = filter.q?.trim();
  if (needle) {
    const pattern = `%${needle}%`;
    conditions.push(
      or(
        ilike(sql`${payment.id}::text`, pattern),
        ilike(payment.buyerId, pattern),
        ilike(lot.title, pattern),
        ilike(bidIdentityDirectory.name, pattern),
        ilike(bidIdentityDirectory.email, pattern),
        ilike(sql`${lotFulfilment.status}::text`, pattern),
      ),
    );
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

function mapRow(
  row: Row,
  xero?: {
    xeroInvoiceNumber: string | null;
    xeroOnlineInvoiceUrl: string | null;
    xeroSyncStatus: "pending_sync" | "synced" | "error" | null;
    xeroLastError: string | null;
  } | null,
): PaymentRecord {
  return {
    id: row.id,
    lotId: row.lotId,
    paidByUserId: row.buyerId,
    buyerLegalEntityId: row.buyerLegalEntityId ?? "",
    sellerLegalEntityId: row.sellerLegalEntityId ?? "",
    amount: String(row.amount),
    platformFee: String(row.platformFee),
    stripePaymentIntentId: row.stripePaymentIntentId,
    stripeChargeId: row.stripeChargeId,
    stripeRefundId: row.stripeRefundId,
    status: row.status,
    createdAt: row.createdAt,
    paymentGroupId: row.paymentGroupId,
    xeroInvoiceNumber: xero?.xeroInvoiceNumber ?? null,
    xeroOnlineInvoiceUrl: xero?.xeroOnlineInvoiceUrl ?? null,
    xeroSyncStatus: xero?.xeroSyncStatus ?? null,
    xeroLastError: xero?.xeroLastError ?? null,
  };
}

export class DrizzlePaymentRepository implements IPaymentWriteRepository {
  constructor(private readonly db: Database) {}

  async create(row: CreatePaymentRow): Promise<PaymentRecord> {
    const [created] = await this.db
      .insert(payment)
      .values({
        lotId: row.lotId,
        buyerId: row.paidByUserId,
        buyerLegalEntityId: row.buyerLegalEntityId,
        sellerLegalEntityId: row.sellerLegalEntityId,
        amount: row.amount,
        platformFee: row.platformFee,
        stripePaymentIntentId: row.stripePaymentIntentId,
        stripeChargeId: row.stripeChargeId ?? null,
        status: row.status ?? "pending",
      })
      .returning();
    if (!created) throw new Error("Payment insert failed");
    return mapRow(created, null);
  }

  async findById(id: string): Promise<PaymentRecord | null> {
    const rows = await this.db.select().from(payment).where(eq(payment.id, id)).limit(1);
    const row = rows[0];
    return row ? mapRow(row, null) : null;
  }

  async findOpenByLotAndBuyer(lotId: string, buyerId: string): Promise<PaymentRecord | null> {
    const rows = await this.db
      .select()
      .from(payment)
      .where(
        and(
          eq(payment.lotId, lotId),
          eq(payment.buyerId, buyerId),
          inArray(payment.status, ["pending", "authorized", "captured", "requires_manual_review"]),
        ),
      )
      .limit(1);
    const row = rows[0];
    return row ? mapRow(row, null) : null;
  }

  async findRefundedByLotAndBuyer(lotId: string, buyerId: string): Promise<PaymentRecord | null> {
    const rows = await this.db
      .select()
      .from(payment)
      .where(
        and(eq(payment.lotId, lotId), eq(payment.buyerId, buyerId), eq(payment.status, "refunded")),
      )
      .limit(1);
    const row = rows[0];
    return row ? mapRow(row, null) : null;
  }

  async findOpenByLotAndBuyerAccount(
    lotId: string,
    buyerLegalEntityId: string,
  ): Promise<PaymentRecord | null> {
    const rows = await this.db
      .select()
      .from(payment)
      .where(
        and(
          eq(payment.lotId, lotId),
          eq(payment.buyerLegalEntityId, buyerLegalEntityId),
          inArray(payment.status, ["pending", "authorized", "captured", "requires_manual_review"]),
        ),
      )
      .limit(1);
    const row = rows[0];
    return row ? mapRow(row, null) : null;
  }

  async findRefundedByLotAndBuyerAccount(
    lotId: string,
    buyerLegalEntityId: string,
  ): Promise<PaymentRecord | null> {
    const rows = await this.db
      .select()
      .from(payment)
      .where(
        and(
          eq(payment.lotId, lotId),
          eq(payment.buyerLegalEntityId, buyerLegalEntityId),
          eq(payment.status, "refunded"),
        ),
      )
      .limit(1);
    const row = rows[0];
    return row ? mapRow(row, null) : null;
  }

  async updateStatus(id: string, status: PaymentRecord["status"]): Promise<void> {
    await this.db.update(payment).set({ status }).where(eq(payment.id, id));
  }

  async updateStripeChargeId(id: string, stripeChargeId: string): Promise<void> {
    await this.db.update(payment).set({ stripeChargeId }).where(eq(payment.id, id));
  }

  async updateStripePaymentIntentId(id: string, stripePaymentIntentId: string): Promise<void> {
    await this.db.update(payment).set({ stripePaymentIntentId }).where(eq(payment.id, id));
  }

  async findByStripePaymentIntentId(stripePaymentIntentId: string): Promise<PaymentRecord | null> {
    const rows = await this.db
      .select()
      .from(payment)
      .where(eq(payment.stripePaymentIntentId, stripePaymentIntentId))
      .limit(1);
    const row = rows[0];
    return row ? mapRow(row, null) : null;
  }

  async applyAuthorizedInTransaction(tx: Database, id: string): Promise<boolean> {
    const rows = await tx
      .update(payment)
      .set({ status: "authorized" })
      .where(and(eq(payment.id, id), eq(payment.status, "pending")))
      .returning({ id: payment.id });
    return rows.length > 0;
  }

  async applyCancelledInTransaction(tx: Database, id: string): Promise<boolean> {
    const rows = await tx
      .update(payment)
      .set({ status: "cancelled" })
      .where(and(eq(payment.id, id), inArray(payment.status, ["pending", "authorized"])))
      .returning({ id: payment.id });
    return rows.length > 0;
  }

  async applyCapturedInTransaction(
    tx: Database,
    id: string,
    opts: { stripeChargeId?: string | null },
  ): Promise<boolean> {
    const patch: Partial<typeof payment.$inferInsert> = { status: "captured" };
    if (opts.stripeChargeId != null && opts.stripeChargeId !== "") {
      patch.stripeChargeId = opts.stripeChargeId;
    }
    const rows = await tx
      .update(payment)
      .set(patch)
      .where(
        and(
          eq(payment.id, id),
          inArray(payment.status, ["pending", "authorized", "requires_manual_review"]),
        ),
      )
      .returning({ id: payment.id });
    return rows.length > 0;
  }

  async applyReleasedFromManualReviewInTransaction(tx: Database, id: string): Promise<boolean> {
    const rows = await tx
      .update(payment)
      .set({ status: "pending" })
      .where(and(eq(payment.id, id), eq(payment.status, "requires_manual_review")))
      .returning({ id: payment.id });
    return rows.length > 0;
  }

  async applyRefundedInTransaction(
    tx: Database,
    id: string,
    stripeRefundId: string | null,
  ): Promise<boolean> {
    const rows = await tx
      .update(payment)
      .set({ status: "refunded", stripeRefundId })
      .where(
        and(eq(payment.id, id), inArray(payment.status, ["captured", "requires_manual_review"])),
      )
      .returning({ id: payment.id });
    return rows.length > 0;
  }

  async listAll(): Promise<PaymentRecord[]> {
    return this.listForExport({ limit: Number.MAX_SAFE_INTEGER, offset: 0 });
  }

  async listForExport(
    filter: ListPaymentsExportFilter & { limit: number; offset: number },
  ): Promise<PaymentRecord[]> {
    const where = exportWhere(filter);
    const base = this.db
      .select({
        payment,
        refInvoiceNumber: paymentExternalRef.xeroInvoiceNumber,
        refOnlineUrl: paymentExternalRef.onlineInvoiceUrl,
        refSyncStatus: paymentExternalRef.syncStatus,
        refLastError: paymentExternalRef.lastError,
      })
      .from(payment)
      .leftJoin(paymentExternalRef, eq(payment.id, paymentExternalRef.paymentId));
    const rows = await (where ? base.where(where) : base)
      .orderBy(desc(payment.createdAt))
      .limit(filter.limit)
      .offset(filter.offset);
    return rows.map((r) =>
      mapRow(r.payment, {
        xeroInvoiceNumber: r.refInvoiceNumber ?? null,
        xeroOnlineInvoiceUrl: r.refOnlineUrl ?? null,
        xeroSyncStatus: r.refSyncStatus ?? null,
        xeroLastError: r.refLastError ?? null,
      }),
    );
  }

  async countForExport(filter: ListPaymentsExportFilter): Promise<number> {
    const where = exportWhere(filter);
    const [row] = await (where
      ? this.db.select({ n: sql<number>`count(*)::int` }).from(payment).where(where)
      : this.db.select({ n: sql<number>`count(*)::int` }).from(payment));
    return row?.n ?? 0;
  }

  async listByBuyerId(buyerId: string): Promise<PaymentRecord[]> {
    return this.listWithExternalRefs(eq(payment.buyerId, buyerId));
  }

  async listByBuyerLegalEntityId(legalEntityId: string): Promise<PaymentRecord[]> {
    return this.listWithExternalRefs(eq(payment.buyerLegalEntityId, legalEntityId));
  }

  private async listWithExternalRefs(where: SQL): Promise<PaymentRecord[]> {
    const rows = await this.db
      .select({
        payment,
        refInvoiceNumber: paymentExternalRef.xeroInvoiceNumber,
        refOnlineUrl: paymentExternalRef.onlineInvoiceUrl,
        refSyncStatus: paymentExternalRef.syncStatus,
        refLastError: paymentExternalRef.lastError,
      })
      .from(payment)
      .leftJoin(paymentExternalRef, eq(payment.id, paymentExternalRef.paymentId))
      .where(where)
      .orderBy(desc(payment.createdAt));
    return rows.map((r) =>
      mapRow(r.payment, {
        xeroInvoiceNumber: r.refInvoiceNumber ?? null,
        xeroOnlineInvoiceUrl: r.refOnlineUrl ?? null,
        xeroSyncStatus: r.refSyncStatus ?? null,
        xeroLastError: r.refLastError ?? null,
      }),
    );
  }

  async countPendingOlderThanHours(hours: number): Promise<number> {
    const cutoff = new Date(Date.now() - hours * 3_600_000);
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(payment)
      .where(and(eq(payment.status, "pending"), lte(payment.createdAt, cutoff)));
    return row?.n ?? 0;
  }

  async listStalePendingBefore(
    cutoff: Date,
  ): Promise<{ id: string; lotId: string; buyerId: string }[]> {
    const rows = await this.db
      .select({
        id: payment.id,
        lotId: payment.lotId,
        buyerId: payment.buyerId,
      })
      .from(payment)
      // A payment in a "Pay several" group is released with its group, never on its own.
      .where(
        and(
          eq(payment.status, "pending"),
          lte(payment.createdAt, cutoff),
          isNull(payment.paymentGroupId),
        ),
      );
    return rows;
  }

  async listStaleAuthorizedBefore(
    cutoff: Date,
  ): Promise<{ id: string; lotId: string; buyerId: string }[]> {
    const rows = await this.db
      .select({
        id: payment.id,
        lotId: payment.lotId,
        buyerId: payment.buyerId,
      })
      .from(payment)
      // A payment in a "Pay several" group is released with its group, never on its own.
      .where(
        and(
          eq(payment.status, "authorized"),
          lte(payment.createdAt, cutoff),
          isNull(payment.paymentGroupId),
        ),
      );
    return rows;
  }

  async sumCapturedBetween(start: Date, end: Date): Promise<string> {
    const [row] = await this.db
      .select({ s: sql<string>`coalesce(sum(${payment.amount}), 0)::text` })
      .from(payment)
      .where(
        and(
          eq(payment.status, "captured"),
          gte(payment.createdAt, start),
          lte(payment.createdAt, end),
        ),
      );
    return row?.s ?? "0";
  }

  async countCreatedAtByDay(rangeStart: Date): Promise<Map<string, number>> {
    return queryCreatedAtDailyCounts(this.db, payment, payment.createdAt, rangeStart);
  }

  async listForAdminTable(
    filter: ListPaymentsAdminTableFilter,
  ): Promise<AdminPaymentTableRowDto[]> {
    const where = adminTableWhere(filter);
    const base = this.db
      .select({
        payment,
        lotTitle: lot.title,
        lotNumber: lot.lotNumber,
        saleTitle: sale.title,
        buyerName: bidIdentityDirectory.name,
        buyerEmail: bidIdentityDirectory.email,
        fulfilmentStatus: lotFulfilment.status,
        refInvoiceNumber: paymentExternalRef.xeroInvoiceNumber,
        refOnlineUrl: paymentExternalRef.onlineInvoiceUrl,
        refSyncStatus: paymentExternalRef.syncStatus,
        refLastError: paymentExternalRef.lastError,
      })
      .from(payment)
      .innerJoin(lot, eq(payment.lotId, lot.id))
      .leftJoin(sale, eq(lot.saleId, sale.id))
      .leftJoin(bidIdentityDirectory, eq(payment.buyerId, bidIdentityDirectory.subjectId))
      .leftJoin(lotFulfilment, eq(lotFulfilment.lotId, payment.lotId))
      .leftJoin(paymentExternalRef, eq(payment.id, paymentExternalRef.paymentId));
    const rows = await (where ? base.where(where) : base)
      .orderBy(desc(payment.createdAt))
      .limit(filter.limit)
      .offset(filter.offset);
    return rows.map((r) => {
      const mapped = mapRow(r.payment, {
        xeroInvoiceNumber: r.refInvoiceNumber ?? null,
        xeroOnlineInvoiceUrl: r.refOnlineUrl ?? null,
        xeroSyncStatus: r.refSyncStatus ?? null,
        xeroLastError: r.refLastError ?? null,
      });
      const buyerLabel = r.buyerName?.trim() || r.buyerEmail?.trim() || null;
      return {
        ...mapped,
        buyerId: r.payment.buyerId,
        sellerId: r.payment.sellerLegalEntityId,
        lotTitle: r.lotTitle,
        lotNumber: r.lotNumber ?? null,
        saleTitle: r.saleTitle ?? null,
        buyerLabel,
        fulfilmentStatus: r.fulfilmentStatus ?? null,
      };
    });
  }

  async countForAdminTable(
    filter: Omit<ListPaymentsAdminTableFilter, "limit" | "offset">,
  ): Promise<number> {
    const where = adminTableWhere(filter);
    const base = this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(payment)
      .innerJoin(lot, eq(payment.lotId, lot.id))
      .leftJoin(bidIdentityDirectory, eq(payment.buyerId, bidIdentityDirectory.subjectId))
      .leftJoin(lotFulfilment, eq(lotFulfilment.lotId, payment.lotId))
      .leftJoin(paymentExternalRef, eq(payment.id, paymentExternalRef.paymentId));
    const [row] = await (where ? base.where(where) : base);
    return row?.n ?? 0;
  }

  async sumAdminTableAmountsByDay(
    filter: Omit<ListPaymentsAdminTableFilter, "limit" | "offset">,
    rangeStart: Date,
  ): Promise<Map<string, AdminPaymentsDailyAmounts>> {
    const where = and(gte(payment.createdAt, rangeStart), adminTableWhere(filter));
    const day = sql`date_trunc('day', ${payment.createdAt} AT TIME ZONE 'UTC')`;
    const amount = sql`round(${payment.amount}::numeric * 100)`;
    const pence = (status?: SQL) =>
      status
        ? sql<string>`coalesce(sum(${amount}) filter (where ${status}), 0)::text`
        : sql<string>`coalesce(sum(${amount}), 0)::text`;
    const rows = await this.db
      .select({
        dayKey: sql<string>`to_char(${day}, 'YYYY-MM-DD')`,
        volume: pence(),
        captured: pence(eq(payment.status, "captured")),
        refunded: pence(eq(payment.status, "refunded")),
        awaiting: pence(inArray(payment.status, ["pending", "authorized"])),
      })
      .from(payment)
      .innerJoin(lot, eq(payment.lotId, lot.id))
      .leftJoin(bidIdentityDirectory, eq(payment.buyerId, bidIdentityDirectory.subjectId))
      .leftJoin(lotFulfilment, eq(lotFulfilment.lotId, payment.lotId))
      .leftJoin(paymentExternalRef, eq(payment.id, paymentExternalRef.paymentId))
      .where(where)
      .groupBy(day);
    return new Map(
      rows.map((row) => [
        row.dayKey,
        {
          volume: Number(row.volume),
          captured: Number(row.captured),
          refunded: Number(row.refunded),
          awaiting: Number(row.awaiting),
        },
      ]),
    );
  }

  async summarizeForAdminTable(
    filter: Omit<ListPaymentsAdminTableFilter, "limit" | "offset">,
  ): Promise<AdminPaymentsSummaryStats> {
    const where = adminTableWhere(filter);
    const base = this.db
      .select({
        totalVolume: sql<string>`coalesce(sum(${payment.amount}), 0)::text`,
        captured: sql<string>`coalesce(sum(${payment.amount}) filter (where ${payment.status} = 'captured'), 0)::text`,
        pending: sql<string>`coalesce(sum(${payment.amount}) filter (where ${payment.status} in ('pending', 'authorized')), 0)::text`,
        refunded: sql<string>`coalesce(sum(${payment.amount}) filter (where ${payment.status} = 'refunded'), 0)::text`,
      })
      .from(payment)
      .innerJoin(lot, eq(payment.lotId, lot.id))
      .leftJoin(bidIdentityDirectory, eq(payment.buyerId, bidIdentityDirectory.subjectId))
      .leftJoin(lotFulfilment, eq(lotFulfilment.lotId, payment.lotId))
      .leftJoin(paymentExternalRef, eq(payment.id, paymentExternalRef.paymentId));
    const [row] = await (where ? base.where(where) : base);
    return {
      totalVolume: row?.totalVolume ?? "0",
      captured: row?.captured ?? "0",
      pending: row?.pending ?? "0",
      refunded: row?.refunded ?? "0",
    };
  }
}
