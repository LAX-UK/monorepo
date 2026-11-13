import type { Database } from "@auction/db";
import {
  bidInvoice,
  bidInvoiceLine,
  domainEvent,
  legalEntity,
  lot,
  payment,
  saleSellerTerms,
} from "@auction/db/schema";
import type { InvoiceLine, InvoiceLineKind, InvoiceSource } from "@auction/types";
import { and, asc, eq, gte, inArray, isNull, lt, notExists, sql } from "drizzle-orm";
import {
  BidInvoiceLotMovedError,
  type BidInvoiceRecord,
  BidInvoiceTotalMismatchError,
  type IBidInvoiceBatchReader,
  type IBidInvoiceDueDateRepository,
  type IBidInvoiceRaiseRepository,
  type IBidInvoiceReader,
  type IInvoicedSalePriceReader,
  type InvoicedSalePrice,
  type OpenInvoiceScope,
  type RaisedInvoice,
  bidInvoiceKey,
} from "../interfaces/bid-invoice.repository.js";
import { mapPaymentRow } from "./drizzle-payment.repository.js";
import { decimalToPence } from "./lot-reoffer.mappers.js";
import { sellerTermsRow } from "./seller-terms-row.js";

type InvoiceRow = typeof bidInvoice.$inferSelect;

/**
 * The payment's stored `platform_fee` as whole pence, for the terms row. It is a record for
 * reconciliation only, so a figure that cannot be read is left unset rather than failing the raise.
 */
function legacyFeePence(platformFee: string | null): number | null {
  if (platformFee === null) return null;
  try {
    return decimalToPence(platformFee);
  } catch {
    return null;
  }
}
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
  implements
    IBidInvoiceReader,
    IBidInvoiceBatchReader,
    IInvoicedSalePriceReader,
    IBidInvoiceRaiseRepository,
    IBidInvoiceDueDateRepository
{
  constructor(private readonly db: Database) {}

  async findInvoicedSalePrices(lotIds: readonly string[]): Promise<Map<string, InvoicedSalePrice>> {
    if (lotIds.length === 0) return new Map();
    const amountOf = (kind: InvoiceLineKind) =>
      sql<
        string | null
      >`sum(${bidInvoiceLine.amountPence}) filter (where ${bidInvoiceLine.kind} = ${kind})`;
    const rows = await this.db
      .select({
        lotId: bidInvoice.lotId,
        pricingPolicyId: bidInvoice.pricingPolicyId,
        hammerPence: amountOf("hammer"),
        premiumPence: amountOf("buyers_premium"),
      })
      .from(bidInvoice)
      .innerJoin(
        lot,
        and(
          eq(lot.id, bidInvoice.lotId),
          eq(lot.buyerLegalEntityId, bidInvoice.buyerLegalEntityId),
        ),
      )
      .innerJoin(bidInvoiceLine, eq(bidInvoiceLine.invoiceId, bidInvoice.id))
      .where(and(isNull(bidInvoice.voidedAt), inArray(bidInvoice.lotId, [...new Set(lotIds)])))
      .groupBy(bidInvoice.id);
    const prices = new Map<string, InvoicedSalePrice>();
    for (const row of rows) {
      // A legacy invoice holds one total line: there is no hammer to show on its own.
      if (row.hammerPence === null) continue;
      prices.set(row.lotId, {
        hammerPence: Number(row.hammerPence),
        premiumPence: Number(row.premiumPence ?? 0),
        pricingPolicyId: row.pricingPolicyId,
      });
    }
    return prices;
  }

  async findLiveByLotAndBuyerAccount(
    lotId: string,
    buyerLegalEntityId: string,
  ): Promise<BidInvoiceRecord | null> {
    return findLive(this.db, lotId, buyerLegalEntityId);
  }

  async findLiveByLotsAndBuyerAccounts(
    pairs: readonly { lotId: string; buyerLegalEntityId: string }[],
  ): Promise<Map<string, BidInvoiceRecord>> {
    if (pairs.length === 0) return new Map();
    const wanted = new Set(pairs.map((p) => bidInvoiceKey(p.lotId, p.buyerLegalEntityId)));
    const rows = await this.db
      .select()
      .from(bidInvoice)
      .where(
        and(
          isNull(bidInvoice.voidedAt),
          inArray(bidInvoice.lotId, [...new Set(pairs.map((p) => p.lotId))]),
          inArray(bidInvoice.buyerLegalEntityId, [
            ...new Set(pairs.map((p) => p.buyerLegalEntityId)),
          ]),
        ),
      );
    // The two filters above cover the product of lots and accounts; keep only the pairs asked for.
    const matching = rows.filter((r) => wanted.has(bidInvoiceKey(r.lotId, r.buyerLegalEntityId)));
    const lines = groupLines(
      await linesOf(
        this.db,
        matching.map((r) => r.id),
      ),
    );
    return new Map(
      matching.map((r) => [
        bidInvoiceKey(r.lotId, r.buyerLegalEntityId),
        toRecord(r, lines.get(r.id) ?? []),
      ]),
    );
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

  async raise(input: Parameters<IBidInvoiceRaiseRepository["raise"]>[0]): Promise<RaisedInvoice> {
    const { invoice, winnerId, payment: paymentRow, sellerTerms } = input;
    return this.db.transaction(async (tx) => {
      const database = tx as unknown as Database;
      await lockLotSoldTo(database, invoice.lotId, winnerId, invoice.buyerLegalEntityId);
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
        // In the same transaction as the invoice, so the books hear of exactly the invoices that exist.
        await database.insert(domainEvent).values({
          aggregateType: "bid_invoice",
          aggregateId: inserted.id,
          eventType: "invoice.raised",
          producer: "packages/db",
          payload: {
            invoiceId: inserted.id,
            lotId: inserted.lotId,
            buyerLegalEntityId: inserted.buyerLegalEntityId,
            totalPence: inserted.totalPence,
            raisedAt: inserted.raisedAt.toISOString(),
          },
          schemaVersion: 1,
        });
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
      await database
        .insert(saleSellerTerms)
        .values(sellerTermsRow(created.id, sellerTerms, legacyFeePence(created.platformFee)));
      return { invoice: record, payment: mapPaymentRow(created, null), invoiceCreated: !!inserted };
    });
  }

  async extendUnpaidDueDates(scope: OpenInvoiceScope, until: Date, tx?: Database): Promise<number> {
    const db = tx ?? this.db;
    const untilAt = sql`${until.toISOString()}::timestamptz`;
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
    const owner =
      scope.kind === "account"
        ? eq(bidInvoice.buyerLegalEntityId, scope.legalEntityId)
        : and(
            eq(lot.winnerId, scope.userId),
            scope.personalAccountsOnly ? eq(legalEntity.kind, "individual") : undefined,
          );
    const inScope = db
      .select({ id: bidInvoice.id })
      .from(bidInvoice)
      .innerJoin(lot, eq(lot.id, bidInvoice.lotId))
      .innerJoin(legalEntity, eq(legalEntity.id, bidInvoice.buyerLegalEntityId))
      .where(
        and(
          isNull(bidInvoice.voidedAt),
          owner,
          noSettledPayment,
          // Overdue before the hold began: that debt is not reset by the release.
          gte(bidInvoice.dueAt, scope.holdStartedAt),
        ),
      );
    const rows = await db
      .update(bidInvoice)
      .set({ dueAt: sql`greatest(${bidInvoice.dueAt}, ${untilAt})` })
      .where(and(inArray(bidInvoice.id, inScope), lt(bidInvoice.dueAt, untilAt)))
      .returning({ id: bidInvoice.id });
    return rows.length;
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

/**
 * Locks the lot row first (the order a buyer default and a re-award use) and refuses unless it is
 * still ended, won by `winnerId` and bought in `buyerLegalEntityId`. A default that committed after
 * the caller read the lot is seen here, and one still running waits for this transaction.
 */
async function lockLotSoldTo(
  db: Database,
  lotId: string,
  winnerId: string,
  buyerLegalEntityId: string,
): Promise<void> {
  const [locked] = await db
    .select({ status: lot.status, winnerId: lot.winnerId, entityId: lot.buyerLegalEntityId })
    .from(lot)
    .where(eq(lot.id, lotId))
    .for("update")
    .limit(1);
  if (
    !locked ||
    locked.status !== "ended" ||
    locked.winnerId !== winnerId ||
    locked.entityId !== buyerLegalEntityId
  ) {
    throw new BidInvoiceLotMovedError(lotId);
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
