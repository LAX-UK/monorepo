import type { Database } from "@auction/db";
import { bidInvoice, bidInvoiceLine, legalEntity, lot, payment } from "@auction/db/schema";
import type { InvoiceLine, InvoiceLineKind, InvoiceSource } from "@auction/types";
import { and, asc, eq, inArray, isNull, lt, notExists, sql } from "drizzle-orm";
import {
  type BidInvoiceRecord,
  BidInvoiceTotalMismatchError,
  type IBidInvoiceDueDateRepository,
  type IBidInvoiceRaiseRepository,
  type IBidInvoiceReader,
  type OpenInvoiceScope,
  type RaisedInvoice,
} from "../interfaces/bid-invoice.repository.js";
import type { CreatePaymentRow } from "../interfaces/payment-write.repository.js";
import { mapPaymentRow } from "./drizzle-payment.repository.js";

type InvoiceRow = typeof bidInvoice.$inferSelect;
type LineRow = typeof bidInvoiceLine.$inferSelect;

function toLine(row: LineRow): InvoiceLine {
  return {
    kind: row.kind as InvoiceLineKind,
    label: row.label,
    ratePercent: row.ratePercent === null ? null : String(Number(row.ratePercent)),
    amountPence: Number(row.amountPence),
  };
}

function toRecord(row: InvoiceRow, lines: readonly LineRow[]): BidInvoiceRecord {
  return {
    id: row.id,
    lotId: row.lotId,
    buyerLegalEntityId: row.buyerLegalEntityId,
    sellerLegalEntityId: row.sellerLegalEntityId,
    totalPence: Number(row.totalPence),
    raisedAt: row.raisedAt,
    dueAt: row.dueAt,
    pricingPolicyId: row.pricingPolicyId,
    number: row.number,
    source: row.source as InvoiceSource,
    voidedAt: row.voidedAt,
    lines: [...lines].sort((a, b) => a.position - b.position).map(toLine),
  };
}

async function linesOf(db: Database, invoiceIds: readonly string[]): Promise<LineRow[]> {
  if (invoiceIds.length === 0) return [];
  return db
    .select()
    .from(bidInvoiceLine)
    .where(inArray(bidInvoiceLine.invoiceId, [...invoiceIds]))
    .orderBy(asc(bidInvoiceLine.invoiceId), asc(bidInvoiceLine.position));
}

function groupLines(lines: readonly LineRow[]): Map<string, LineRow[]> {
  const byInvoice = new Map<string, LineRow[]>();
  for (const line of lines) {
    const group = byInvoice.get(line.invoiceId);
    if (group) group.push(line);
    else byInvoice.set(line.invoiceId, [line]);
  }
  return byInvoice;
}

/** Bid invoices and their lines: read, raised with their payment, and due-date extension. */
export class DrizzleBidInvoiceRepository
  implements IBidInvoiceReader, IBidInvoiceRaiseRepository, IBidInvoiceDueDateRepository
{
  constructor(private readonly db: Database) {}

  async findLiveByLotAndBuyerAccount(
    lotId: string,
    buyerLegalEntityId: string,
  ): Promise<BidInvoiceRecord | null> {
    return findLive(this.db, lotId, buyerLegalEntityId);
  }

  async findByPaymentIds(paymentIds: readonly string[]): Promise<Map<string, BidInvoiceRecord>> {
    if (paymentIds.length === 0) return new Map();
    const links = await this.db
      .select({ paymentId: payment.id, invoice: bidInvoice })
      .from(payment)
      .innerJoin(bidInvoice, eq(bidInvoice.id, payment.invoiceId))
      .where(inArray(payment.id, [...paymentIds]));
    const lines = groupLines(await linesOf(this.db, [...new Set(links.map((l) => l.invoice.id))]));
    return new Map(
      links.map((l) => [l.paymentId, toRecord(l.invoice, lines.get(l.invoice.id) ?? [])]),
    );
  }

  async raise(input: {
    invoice: Parameters<IBidInvoiceRaiseRepository["raise"]>[0]["invoice"];
    payment: Omit<CreatePaymentRow, "amount" | "invoiceId">;
  }): Promise<RaisedInvoice> {
    const { invoice, payment: paymentRow } = input;
    return this.db.transaction(async (tx) => {
      const database = tx as unknown as Database;
      const [inserted] = await database
        .insert(bidInvoice)
        .values({
          lotId: invoice.lotId,
          buyerLegalEntityId: invoice.buyerLegalEntityId,
          sellerLegalEntityId: invoice.sellerLegalEntityId,
          totalPence: invoice.totalPence,
          raisedAt: invoice.raisedAt,
          dueAt: invoice.dueAt,
          pricingPolicyId: invoice.pricingPolicyId,
          source: "raised",
        })
        // A live invoice may already exist (a retry after the last payment expired, or a request
        // that raced this one): it is used as it is, never priced again.
        .onConflictDoNothing({
          target: [bidInvoice.lotId, bidInvoice.buyerLegalEntityId],
          // The partial unique index's predicate, written unqualified as Postgres infers it.
          where: sql`"voided_at" is null`,
        })
        .returning();

      let record: BidInvoiceRecord;
      if (inserted) {
        const lineRows = await database
          .insert(bidInvoiceLine)
          .values(
            invoice.lines.map((line, index) => ({
              invoiceId: inserted.id,
              position: index + 1,
              kind: line.kind,
              label: line.label,
              ratePercent: line.ratePercent,
              amountPence: line.amountPence,
            })),
          )
          .returning();
        record = toRecord(inserted, lineRows);
      } else {
        const existing = await findLive(database, invoice.lotId, invoice.buyerLegalEntityId);
        if (!existing) throw new Error("Invoice insert conflicted but no live invoice was found");
        if (existing.totalPence !== invoice.totalPence) {
          throw new BidInvoiceTotalMismatchError(
            existing.id,
            existing.totalPence,
            invoice.totalPence,
          );
        }
        record = existing;
      }

      const [created] = await database
        .insert(payment)
        .values({
          lotId: paymentRow.lotId,
          buyerId: paymentRow.paidByUserId,
          buyerLegalEntityId: paymentRow.buyerLegalEntityId,
          sellerLegalEntityId: paymentRow.sellerLegalEntityId,
          // The payment always takes the invoice's total, never a newly worked out one.
          amount: sql<string>`${record.totalPence}::numeric / 100`,
          platformFee: paymentRow.platformFee,
          stripePaymentIntentId: paymentRow.stripePaymentIntentId,
          stripeChargeId: paymentRow.stripeChargeId ?? null,
          status: paymentRow.status ?? "pending",
          invoiceId: record.id,
        })
        .returning();
      if (!created) throw new Error("Payment insert failed");
      return { invoice: record, payment: mapPaymentRow(created, null), invoiceCreated: !!inserted };
    });
  }

  async listUnpaidLiveInvoiceIds(scope: OpenInvoiceScope, tx?: Database): Promise<string[]> {
    const db = tx ?? this.db;
    const noSettledPayment = notExists(
      db
        .select({ one: sql`1` })
        .from(payment)
        .where(
          and(
            eq(payment.invoiceId, bidInvoice.id),
            inArray(payment.status, [
              "captured",
              "authorized",
              "refunded",
              "requires_manual_review",
            ]),
          ),
        ),
    );
    const base = db
      .select({ id: bidInvoice.id })
      .from(bidInvoice)
      .innerJoin(lot, eq(lot.id, bidInvoice.lotId))
      .innerJoin(legalEntity, eq(legalEntity.id, bidInvoice.buyerLegalEntityId));
    const owner =
      scope.kind === "account"
        ? eq(bidInvoice.buyerLegalEntityId, scope.legalEntityId)
        : and(
            eq(lot.winnerId, scope.userId),
            scope.personalAccountsOnly ? eq(legalEntity.kind, "individual") : undefined,
          );
    const rows = await base.where(and(isNull(bidInvoice.voidedAt), owner, noSettledPayment));
    return rows.map((r) => r.id);
  }

  async extendDueAt(invoiceId: string, notBefore: Date, tx?: Database): Promise<boolean> {
    const rows = await (tx ?? this.db)
      .update(bidInvoice)
      .set({ dueAt: notBefore })
      .where(
        and(
          eq(bidInvoice.id, invoiceId),
          isNull(bidInvoice.voidedAt),
          lt(bidInvoice.dueAt, sql`${notBefore.toISOString()}::timestamptz`),
        ),
      )
      .returning({ id: bidInvoice.id });
    return rows.length > 0;
  }
}

async function findLive(
  db: Database,
  lotId: string,
  buyerLegalEntityId: string,
): Promise<BidInvoiceRecord | null> {
  const [row] = await db
    .select()
    .from(bidInvoice)
    .where(
      and(
        eq(bidInvoice.lotId, lotId),
        eq(bidInvoice.buyerLegalEntityId, buyerLegalEntityId),
        isNull(bidInvoice.voidedAt),
      ),
    )
    .limit(1);
  if (!row) return null;
  return toRecord(row, await linesOf(db, [row.id]));
}
