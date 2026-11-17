import type { Database } from "@auction/db";
import {
  bidInvoice,
  deliveryQuote,
  legalEntity,
  lot,
  lotFulfilment,
  payment,
  sale,
  saleRegistration,
} from "@auction/db/schema";
import {
  DELIVERY_STATUSES,
  type DeliveryQuoteStatus,
  type DeliveryStatus,
  type FulfilmentFacts,
  deliveryStatusOf,
  purchaseInvoiceState,
} from "@auction/domain";
import {
  type AnyColumn,
  type SQL,
  and,
  asc,
  desc,
  eq,
  exists,
  gte,
  ilike,
  or,
  sql,
} from "drizzle-orm";
import type {
  AdminDeliveriesFilters,
  AdminDeliveriesQuery,
  AdminDeliveryRecord,
  AdminDeliveryStatusCounts,
  IAdminDeliveriesReader,
} from "../interfaces/admin-deliveries.reader.js";
import { containsPattern } from "../lib/like-pattern.js";
import { invoicePaymentOrder } from "../lib/purchase-invoice-payment.js";

/**
 * Each lot's latest quote: a live one (requested, quoted, accepted) before a withdrawn one, then
 * the newest request. A lot carries at most one live quote, so this is the delivery staff work on;
 * earlier withdrawn requests stay as history.
 */
function latestQuotes(db: Database) {
  return db
    .$with("latest_quote")
    .as(
      db
        .selectDistinctOn([deliveryQuote.lotId])
        .from(deliveryQuote)
        .orderBy(
          deliveryQuote.lotId,
          sql`CASE WHEN ${deliveryQuote.status} = 'withdrawn' THEN 1 ELSE 0 END`,
          desc(deliveryQuote.requestedAt),
        ),
    );
}

type LatestQuotes = ReturnType<typeof latestQuotes>;

/** The quote columns the status rule reads: the latest quote, or `delivery_quote` itself. */
type QuoteColumns = {
  lotId: AnyColumn;
  buyerLegalEntityId: AnyColumn;
  status: AnyColumn;
  requestedAt: AnyColumn;
  quotedAt: AnyColumn;
  decidedAt: AnyColumn;
};

/**
 * The purchase's invoice payment for the quote's lot and account, picked as the buyer's purchase
 * page picks it, joined laterally so a refund closes the delivery on both sides.
 */
function invoicePayment(db: Database, quote: QuoteColumns) {
  return db
    .select({
      status: sql<string>`${payment.status}`.as("invoice_payment_status"),
      raisedAt: sql<Date>`${payment.createdAt}`.as("invoice_payment_raised_at"),
      dueAt: sql<Date | null>`${bidInvoice.dueAt}`.as("invoice_payment_due_at"),
    })
    .from(payment)
    .leftJoin(bidInvoice, eq(bidInvoice.id, payment.invoiceId))
    .where(
      and(eq(payment.lotId, quote.lotId), eq(payment.buyerLegalEntityId, quote.buyerLegalEntityId)),
    )
    .orderBy(...invoicePaymentOrder())
    .limit(1)
    .as("invoice_payment");
}

type InvoicePayment = ReturnType<typeof invoicePayment>;

/**
 * `deliveryStatusOf` in SQL, so a view filters and counts in the database: a withdrawn request,
 * a cancelled or refunded purchase, or a lot collected in person is closed; a shipping
 * fulfilment in transit is on the way; a delivered one (not collected) is delivered; otherwise
 * the quote. Keep the two in step: the integration test checks they agree for every quote,
 * fulfilment status, method and invoice.
 */
function statusSql(q: QuoteColumns, invoice: InvoicePayment): SQL<DeliveryStatus> {
  return sql<DeliveryStatus>`CASE
    WHEN ${q.status} = 'withdrawn' THEN 'closed'
    WHEN ${lotFulfilment.status} = 'cancelled' OR ${invoice.status} = 'refunded' THEN 'closed'
    WHEN ${lotFulfilment.status} = 'delivered' AND ${lotFulfilment.fulfilmentMethod} = 'collection'
      THEN 'closed'
    WHEN ${lotFulfilment.status} = 'delivered' THEN 'delivered'
    WHEN ${lotFulfilment.status} = 'in_transit'
      AND ${lotFulfilment.fulfilmentMethod} IS DISTINCT FROM 'collection' THEN 'on_the_way'
    WHEN ${q.status} = 'requested' THEN 'waiting'
    WHEN ${q.status} = 'quoted' THEN 'quoted'
    ELSE 'to_dispatch'
  END`;
}

/**
 * When the delivery reached its status, by the same branches as `statusSql`, from recorded event
 * times only. Dispatch, delivery, cancellation and refund keep no time of their own, so they give
 * null; the fulfilment's `updated_at` is never used, because any later edit moves it.
 */
function statusSinceSql(q: QuoteColumns, invoice: InvoicePayment): SQL<Date | null> {
  return sql<Date | null>`CASE
    WHEN ${q.status} = 'withdrawn' THEN ${q.decidedAt}
    WHEN ${lotFulfilment.status} = 'cancelled' OR ${invoice.status} = 'refunded' THEN NULL
    WHEN ${lotFulfilment.status} = 'delivered' AND ${lotFulfilment.fulfilmentMethod} = 'collection'
      THEN ${lotFulfilment.collectedAt}
    WHEN ${lotFulfilment.status} = 'delivered' THEN NULL
    WHEN ${lotFulfilment.status} = 'in_transit'
      AND ${lotFulfilment.fulfilmentMethod} IS DISTINCT FROM 'collection' THEN NULL
    WHEN ${q.status} = 'requested' THEN ${q.requestedAt}
    WHEN ${q.status} = 'quoted' THEN ${q.quotedAt}
    ELSE ${q.decidedAt}
  END`;
}

/**
 * The order of a view: the time the delivery reached its status, else the latest stamp the quote
 * recorded. Every term is an event time, so editing a fulfilment never reorders a view.
 */
function orderKeySql(q: QuoteColumns, invoice: InvoicePayment): SQL<Date> {
  return sql<Date>`coalesce(${statusSinceSql(q, invoice)}, ${q.decidedAt}, ${q.quotedAt}, ${q.requestedAt})`;
}

/** The buyer's paddle in the lot's sale, when they have one. */
function paddleSql(q: LatestQuotes): SQL<number | null> {
  return sql<number | null>`(
    SELECT min(${saleRegistration.paddleNumber}) FROM ${saleRegistration}
    WHERE ${saleRegistration.saleId} = ${lot.saleId}
      AND ${saleRegistration.buyerLegalEntityId} = ${q.buyerLegalEntityId}
  )`;
}

/**
 * Typed text matches a lot title, buyer name or destination; a number also matches a lot number
 * or a paddle ("42" or "Lot 42").
 */
function searchCondition(q: LatestQuotes, search: string): SQL | undefined {
  const text = search.trim();
  if (!text) return undefined;
  const pattern = containsPattern(text);
  const digits = /^(?:lot\s*)?(\d{1,9})$/i.exec(text)?.[1];
  const number = digits ? Number.parseInt(digits, 10) : null;
  return or(
    ilike(lot.title, pattern),
    ilike(legalEntity.displayName, pattern),
    ilike(q.destination, pattern),
    ...(number !== null ? [eq(lot.lotNumber, number), sql`${paddleSql(q)} = ${number}`] : []),
  );
}

function filterConditions(q: LatestQuotes, filters: AdminDeliveriesFilters): SQL | undefined {
  return and(
    filters.saleId ? eq(lot.saleId, filters.saleId) : undefined,
    filters.search ? searchCondition(q, filters.search) : undefined,
  );
}

function selectDeliveries(db: Database) {
  const q = latestQuotes(db);
  const invoice = invoicePayment(db, q);
  const query = db
    .with(q)
    .select({
      quoteId: q.id,
      lotId: q.lotId,
      quoteStatus: q.status,
      destination: q.destination,
      amount: q.amount,
      currency: q.currency,
      quoteNote: q.quoteNote,
      requestedAt: q.requestedAt,
      quotedAt: q.quotedAt,
      decidedAt: q.decidedAt,
      declineReason: q.declineReason,
      statusSince: statusSinceSql(q, invoice).mapWith((value: string | Date) => asDate(value)),
      lotTitle: lot.title,
      lotNumber: lot.lotNumber,
      lotImage: sql<string | null>`${lot.images}[1]`,
      lotDimensions: lot.dimensions,
      hammerPrice: lot.currentPrice,
      saleId: sale.id,
      saleTitle: sale.title,
      saleEndsAt: sale.endTime,
      buyerLegalEntityId: q.buyerLegalEntityId,
      buyerName: legalEntity.displayName,
      paddleNumber: paddleSql(q),
      fulfilmentStatus: lotFulfilment.status,
      fulfilmentMethod: lotFulfilment.fulfilmentMethod,
      carrier: lotFulfilment.shippingCarrier,
      trackingNumber: lotFulfilment.trackingNumber,
      paidAt: lotFulfilment.paymentClearedAt,
      collectedAt: lotFulfilment.collectedAt,
      invoicePaymentStatus: invoice.status,
      invoiceRaisedAt: invoice.raisedAt,
      invoiceDueAt: invoice.dueAt,
    })
    .from(q)
    .innerJoin(lot, eq(q.lotId, lot.id))
    .innerJoin(legalEntity, eq(q.buyerLegalEntityId, legalEntity.id))
    .leftJoin(sale, eq(lot.saleId, sale.id))
    .leftJoin(lotFulfilment, eq(lotFulfilment.lotId, q.lotId))
    .leftJoinLateral(invoice, sql`true`);
  return { q, invoice, query };
}

const asDate = (value: Date | string | null): Date | null =>
  value === null ? null : value instanceof Date ? value : new Date(value);

type Row = Awaited<ReturnType<typeof selectDeliveries>["query"]>[number];

function toRecord(row: Row, now: Date): AdminDeliveryRecord {
  const fulfilment: FulfilmentFacts | null = row.fulfilmentStatus
    ? { status: row.fulfilmentStatus, method: row.fulfilmentMethod }
    : null;
  const quoteStatus = row.quoteStatus as DeliveryQuoteStatus;
  const raisedAt = asDate(row.invoiceRaisedAt);
  // The invoice as the buyer's purchase page reads it (see `invoiceOf` in the purchase view).
  const invoice = purchaseInvoiceState(
    {
      saleCancelled: fulfilment?.status === "cancelled",
      payment:
        row.invoicePaymentStatus && raisedAt
          ? {
              status: row.invoicePaymentStatus as NonNullable<
                Parameters<typeof purchaseInvoiceState>[0]["payment"]
              >["status"],
              raisedAt,
              dueAt: asDate(row.invoiceDueAt),
            }
          : null,
    },
    now,
  ).status;
  const derived = deliveryStatusOf({ quote: quoteStatus, fulfilment, invoice });
  return {
    quoteId: row.quoteId,
    lotId: row.lotId,
    ...derived,
    statusSince: row.statusSince,
    quote: {
      status: quoteStatus,
      destination: row.destination,
      amount: row.amount,
      currency: row.currency,
      note: row.quoteNote,
      requestedAt: row.requestedAt,
      quotedAt: row.quotedAt,
      decidedAt: row.decidedAt,
      declineReason: row.declineReason,
    },
    lot: {
      title: row.lotTitle,
      lotNumber: row.lotNumber,
      imageUrl: row.lotImage?.trim() ? row.lotImage : null,
      dimensions: row.lotDimensions,
      hammerPrice: row.hammerPrice,
    },
    sale:
      row.saleId && row.saleTitle && row.saleEndsAt
        ? { id: row.saleId, title: row.saleTitle, endsAt: row.saleEndsAt }
        : null,
    buyer: {
      legalEntityId: row.buyerLegalEntityId,
      name: row.buyerName,
      paddleNumber: row.paddleNumber === null ? null : Number(row.paddleNumber),
    },
    fulfilment: fulfilment
      ? {
          ...fulfilment,
          carrier: row.carrier,
          trackingNumber: row.trackingNumber,
          paidAt: row.paidAt,
          collectedAt: row.collectedAt,
        }
      : null,
  };
}

export class DrizzleAdminDeliveriesReader implements IAdminDeliveriesReader {
  constructor(
    private readonly db: Database,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async list(query: AdminDeliveriesQuery) {
    const { q, invoice, query: base } = selectDeliveries(this.db);
    const where = and(eq(statusSql(q, invoice), query.status), filterConditions(q, query));
    const key = orderKeySql(q, invoice);
    const order = query.sort === "oldest" ? [asc(key), asc(q.id)] : [desc(key), desc(q.id)];
    const counted = latestQuotes(this.db);
    const countedInvoice = invoicePayment(this.db, counted);
    const [rows, [total]] = await Promise.all([
      base
        .where(where)
        .orderBy(...order)
        .limit(query.limit)
        .offset(query.offset),
      this.db
        .with(counted)
        .select({ value: sql<number>`count(*)::int` })
        .from(counted)
        .innerJoin(lot, eq(counted.lotId, lot.id))
        .innerJoin(legalEntity, eq(counted.buyerLegalEntityId, legalEntity.id))
        .leftJoin(lotFulfilment, eq(lotFulfilment.lotId, counted.lotId))
        .leftJoinLateral(countedInvoice, sql`true`)
        .where(
          and(
            eq(statusSql(counted, countedInvoice), query.status),
            filterConditions(counted, query),
          ),
        ),
    ]);
    const now = this.clock();
    return { rows: rows.map((row) => toRecord(row, now)), total: total?.value ?? 0 };
  }

  async counts(filters: AdminDeliveriesFilters): Promise<AdminDeliveryStatusCounts> {
    const q = latestQuotes(this.db);
    const invoice = invoicePayment(this.db, q);
    const status = statusSql(q, invoice);
    const grouped = await this.db
      .with(q)
      .select({ status, value: sql<number>`count(*)::int` })
      .from(q)
      .innerJoin(lot, eq(q.lotId, lot.id))
      .innerJoin(legalEntity, eq(q.buyerLegalEntityId, legalEntity.id))
      .leftJoin(lotFulfilment, eq(lotFulfilment.lotId, q.lotId))
      .leftJoinLateral(invoice, sql`true`)
      .where(filterConditions(q, filters))
      .groupBy(status);
    const counts = Object.fromEntries(
      DELIVERY_STATUSES.map((s) => [s, 0]),
    ) as AdminDeliveryStatusCounts;
    for (const row of grouped) counts[row.status] = row.value;
    return counts;
  }

  /**
   * Only `requested` quotes can be waiting, and a requested quote is always its lot's latest (a
   * lot holds one live quote), so this reads `delivery_quote_requested_idx` instead of ranking
   * every quote, then drops the ones whose purchase has moved on, by the same rule.
   */
  async waitingCount(): Promise<number> {
    const invoice = invoicePayment(this.db, deliveryQuote);
    const [row] = await this.db
      .select({ value: sql<number>`count(*)::int` })
      .from(deliveryQuote)
      .leftJoin(lotFulfilment, eq(lotFulfilment.lotId, deliveryQuote.lotId))
      .leftJoinLateral(invoice, sql`true`)
      .where(
        and(
          eq(deliveryQuote.status, "requested"),
          eq(statusSql(deliveryQuote, invoice), "waiting"),
        ),
      );
    return row?.value ?? 0;
  }

  async sales(options: { since: Date; limit: number }) {
    return this.db
      .select({ id: sale.id, title: sale.title })
      .from(sale)
      .where(
        exists(
          this.db
            .select({ one: sql`1` })
            .from(deliveryQuote)
            .innerJoin(lot, eq(deliveryQuote.lotId, lot.id))
            .where(and(eq(lot.saleId, sale.id), gte(deliveryQuote.requestedAt, options.since))),
        ),
      )
      .orderBy(desc(sale.endTime), asc(sale.title))
      .limit(options.limit);
  }

  async findByLotId(lotId: string) {
    const { q, query } = selectDeliveries(this.db);
    const [row] = await query.where(eq(q.lotId, lotId)).limit(1);
    return row ? toRecord(row, this.clock()) : null;
  }
}
