import type { Database } from "@auction/db";
import { payment, paymentExternalRef } from "@auction/db/schema";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import type {
  CreatePaymentRow,
  IPaymentWriteRepository,
  PaymentRecord,
} from "../services/interfaces/payment-write.js";

type Row = InferSelectModel<typeof payment>;

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
      .where(and(eq(payment.id, id), inArray(payment.status, ["pending", "authorized"])))
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

  async listByBuyerId(buyerId: string): Promise<PaymentRecord[]> {
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
      .where(eq(payment.buyerId, buyerId))
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
      .where(and(eq(payment.status, "pending"), lte(payment.createdAt, cutoff)));
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
}
