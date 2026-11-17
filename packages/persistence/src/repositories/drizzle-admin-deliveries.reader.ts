import type { Database } from "@auction/db";
import {
  deliveryQuote,
  legalEntity,
  lot,
  lotFulfilment,
  sale,
  saleRegistration,
} from "@auction/db/schema";
import {
  DELIVERY_STATUSES,
  type DeliveryQuoteStatus,
  type DeliveryStatus,
  type FulfilmentFacts,
  deliveryStatusOf,
} from "@auction/domain";
import { type SQL, and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import type {
  AdminDeliveriesFilters,
  AdminDeliveriesQuery,
  AdminDeliveryRecord,
  AdminDeliveryStatusCounts,
  IAdminDeliveriesReader,
} from "../interfaces/admin-deliveries.reader.js";
import { containsPattern } from "../lib/like-pattern.js";

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

/**
 * `deliveryStatusOf` in SQL, so a view filters and counts in the database. Keep the two in step:
 * the integration test checks they agree for every quote and fulfilment status.
 */
function statusSql(q: LatestQuotes): SQL<DeliveryStatus> {
  return sql<DeliveryStatus>`CASE
    WHEN ${q.status} = 'withdrawn' THEN 'closed'
    WHEN ${lotFulfilment.status} = 'cancelled' THEN 'closed'
    WHEN ${lotFulfilment.status} = 'delivered' THEN 'delivered'
    WHEN ${lotFulfilment.status} = 'in_transit' THEN 'on_the_way'
    WHEN ${q.status} = 'requested' THEN 'waiting'
    WHEN ${q.status} = 'quoted' THEN 'quoted'
    ELSE 'to_dispatch'
  END`;
}

/** When the delivery reached its status, for the "Waiting" column and the order of a view. */
function statusSinceSql(q: LatestQuotes): SQL<Date> {
  return sql<Date>`CASE
    WHEN ${q.status} = 'withdrawn' THEN coalesce(${q.decidedAt}, ${q.updatedAt})
    WHEN ${lotFulfilment.status} IN ('cancelled', 'delivered', 'in_transit')
      THEN ${lotFulfilment.updatedAt}
    WHEN ${q.status} = 'requested' THEN ${q.requestedAt}
    WHEN ${q.status} = 'quoted' THEN coalesce(${q.quotedAt}, ${q.updatedAt})
    ELSE coalesce(${q.decidedAt}, ${q.updatedAt})
  END`;
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
      statusSince: statusSinceSql(q).mapWith((value: string | Date) => new Date(value)),
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
      fulfilmentUpdatedAt: lotFulfilment.updatedAt,
    })
    .from(q)
    .innerJoin(lot, eq(q.lotId, lot.id))
    .innerJoin(legalEntity, eq(q.buyerLegalEntityId, legalEntity.id))
    .leftJoin(sale, eq(lot.saleId, sale.id))
    .leftJoin(lotFulfilment, eq(lotFulfilment.lotId, q.lotId));
  return { q, query };
}

type Row = Awaited<ReturnType<typeof selectDeliveries>["query"]>[number];

function toRecord(row: Row): AdminDeliveryRecord {
  const fulfilment: FulfilmentFacts | null = row.fulfilmentStatus
    ? { status: row.fulfilmentStatus, method: row.fulfilmentMethod }
    : null;
  const quoteStatus = row.quoteStatus as DeliveryQuoteStatus;
  const derived = deliveryStatusOf({ quote: quoteStatus, fulfilment });
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
    fulfilment:
      fulfilment && row.fulfilmentUpdatedAt
        ? {
            ...fulfilment,
            carrier: row.carrier,
            trackingNumber: row.trackingNumber,
            paidAt: row.paidAt,
            updatedAt: row.fulfilmentUpdatedAt,
          }
        : null,
  };
}

export class DrizzleAdminDeliveriesReader implements IAdminDeliveriesReader {
  constructor(private readonly db: Database) {}

  async list(query: AdminDeliveriesQuery) {
    const { q, query: base } = selectDeliveries(this.db);
    const where = and(eq(statusSql(q), query.status), filterConditions(q, query));
    const since = statusSinceSql(q);
    const order = query.sort === "oldest" ? [asc(since), asc(q.id)] : [desc(since), desc(q.id)];
    const counted = latestQuotes(this.db);
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
        .where(and(eq(statusSql(counted), query.status), filterConditions(counted, query))),
    ]);
    return { rows: rows.map(toRecord), total: total?.value ?? 0 };
  }

  async counts(filters: AdminDeliveriesFilters): Promise<AdminDeliveryStatusCounts> {
    const q = latestQuotes(this.db);
    const status = statusSql(q);
    const grouped = await this.db
      .with(q)
      .select({ status, value: sql<number>`count(*)::int` })
      .from(q)
      .innerJoin(lot, eq(q.lotId, lot.id))
      .innerJoin(legalEntity, eq(q.buyerLegalEntityId, legalEntity.id))
      .leftJoin(lotFulfilment, eq(lotFulfilment.lotId, q.lotId))
      .where(filterConditions(q, filters))
      .groupBy(status);
    const counts = Object.fromEntries(
      DELIVERY_STATUSES.map((s) => [s, 0]),
    ) as AdminDeliveryStatusCounts;
    for (const row of grouped) counts[row.status] = row.value;
    return counts;
  }

  async sales() {
    return this.db
      .selectDistinct({ id: sale.id, title: sale.title })
      .from(deliveryQuote)
      .innerJoin(lot, eq(deliveryQuote.lotId, lot.id))
      .innerJoin(sale, eq(lot.saleId, sale.id))
      .orderBy(asc(sale.title));
  }

  async findByLotId(lotId: string) {
    const { q, query } = selectDeliveries(this.db);
    const [row] = await query.where(eq(q.lotId, lotId)).limit(1);
    return row ? toRecord(row) : null;
  }
}
