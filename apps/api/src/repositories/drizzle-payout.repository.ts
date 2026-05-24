import type { Database } from "@auction/db";
import { payment, payout, payoutLine } from "@auction/db/schema";
import type { Payout, PayoutLine, PayoutLineKind, PayoutStatus } from "@auction/types";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import type {
  CreatePayoutInput,
  IPayoutRepository,
  InsertPayoutLineInput,
  ListPayoutsFilter,
  PendingPaymentRow,
  ReconcileStripeTransferPatch,
} from "../services/interfaces/payout-repository.js";

type PayoutRow = typeof payout.$inferSelect;
type PayoutLineRow = typeof payoutLine.$inferSelect;

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
  };
}

function rowToLine(row: PayoutLineRow): PayoutLine {
  return {
    id: row.id,
    payoutId: row.payoutId,
    paymentId: row.paymentId ?? null,
    amount: String(row.amount),
    kind: row.kind as PayoutLineKind,
    createdByUserId: row.createdByUserId ?? null,
    note: row.note ?? null,
    createdAt: row.createdAt,
  };
}

export class DrizzlePayoutRepository implements IPayoutRepository {
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
    const conditions = [
      filter.legalEntityId ? eq(payout.legalEntityId, filter.legalEntityId) : undefined,
      filter.status ? eq(payout.status, filter.status) : undefined,
    ].filter((c): c is NonNullable<typeof c> => c !== undefined);
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;

    const rows = await (where
      ? this.db
          .select()
          .from(payout)
          .where(where)
          .orderBy(desc(payout.periodEnd))
          .limit(limit)
          .offset(offset)
      : this.db.select().from(payout).orderBy(desc(payout.periodEnd)).limit(limit).offset(offset));
    return rows.map(rowToPayout);
  }

  async findById(payoutId: string): Promise<Payout | null> {
    const rows = await this.db.select().from(payout).where(eq(payout.id, payoutId)).limit(1);
    return rows[0] ? rowToPayout(rows[0]) : null;
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

  async listLines(payoutId: string): Promise<PayoutLine[]> {
    const rows = await this.db
      .select()
      .from(payoutLine)
      .where(eq(payoutLine.payoutId, payoutId))
      .orderBy(payoutLine.createdAt);
    return rows.map(rowToLine);
  }

  async findUnlinkedCapturedPayments(legalEntityId: string): Promise<PendingPaymentRow[]> {
    const rows = await this.db
      .select({
        id: payment.id,
        amount: payment.amount,
        platformFee: payment.platformFee,
        capturedAt: payment.createdAt,
      })
      .from(payment)
      .where(
        and(
          eq(payment.sellerLegalEntityId, legalEntityId),
          eq(payment.status, "captured"),
          sql`(${payment.amount})::numeric > 0`,
          sql`NOT EXISTS (
            SELECT 1 FROM payout_line pl
            WHERE pl.payment_id = ${payment.id} AND pl.kind = 'sale'
          )`,
        ),
      )
      .orderBy(payment.createdAt);

    return rows.map((r) => ({
      id: r.id,
      amount: String(r.amount),
      platformFee: String(r.platformFee),
      capturedAt: r.capturedAt,
      settlementAmount: String(r.amount),
    }));
  }

  async listLegalEntityIdsWithUnlinkedCapturedPayments(): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ legalEntityId: payment.sellerLegalEntityId })
      .from(payment)
      .where(
        and(
          eq(payment.status, "captured"),
          isNotNull(payment.sellerLegalEntityId),
          sql`NOT EXISTS (
            SELECT 1 FROM payout_line pl
            WHERE pl.payment_id = ${payment.id} AND pl.kind = 'sale'
          )`,
          sql`(${payment.amount})::numeric > 0`,
        ),
      );
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
    totals: { grossAmount: string; platformFee: string; netAmount: string },
  ): Promise<Payout> {
    const [row] = await this.db
      .update(payout)
      .set({
        grossAmount: totals.grossAmount,
        platformFee: totals.platformFee,
        netAmount: totals.netAmount,
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
          sql`${payout.status} IN ('scheduled', 'in_transit')`,
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
    const rows = await this.db
      .select({
        total: sql<string>`COALESCE(SUM(${payoutLine.amount}), 0)`,
      })
      .from(payoutLine)
      .where(and(eq(payoutLine.paymentId, paymentId), eq(payoutLine.kind, "refund")));
    const totalMajor = Number.parseFloat(rows[0]?.total ?? "0");
    return Math.round(Math.abs(totalMajor) * 100);
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
  ): Promise<PayoutLine> {
    const [row] = await this.db
      .update(payoutLine)
      .set({
        amount,
        ...(sourceEventId !== undefined ? { sourceEventId } : {}),
      })
      .where(eq(payoutLine.id, lineId))
      .returning();
    if (!row) throw new Error("payout_line_update_failed");
    return rowToLine(row);
  }
}
