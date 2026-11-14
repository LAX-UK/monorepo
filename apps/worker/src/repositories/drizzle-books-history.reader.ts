import type { Database } from "@auction/db";
import { accountingDocument, domainEvent, shopOrder } from "@auction/db/schema";
import { and, asc, count, gt, gte, inArray, isNotNull, like, lt } from "drizzle-orm";
import type { AccountingEvent } from "../finance/accounting/accounting-event-routes.js";

/** A Shop order paid before the cutover, with the number the Shop gave its invoice. */
export interface ShopHistoryOrder {
  readonly orderId: string;
  readonly invoiceNumber: string;
}

/**
 * What the Books history import and backfill read. Read-only, and only rows the worker is already
 * granted: the Shop order's id, number and payment time, the accounting queue, the domain events.
 */
export interface IBooksHistoryReader {
  /**
   * Shop orders paid in [since, before) that have an invoice number, by invoice number, after
   * `afterInvoiceNumber` (exclusive), at most `limit`.
   */
  paidShopOrders(input: {
    readonly since: Date | null;
    readonly before: Date;
    readonly afterInvoiceNumber: string | null;
    readonly limit: number;
  }): Promise<readonly ShopHistoryOrder[]>;
  /** Accounting documents created in the UTC day starting `dayStart` whose source starts with `sourcePrefix`. */
  documentsCreatedOn(sourcePrefix: string, dayStart: Date): Promise<number>;
  /** Domain events of these types in [from, to), by id, after `afterId`, at most `limit`. */
  eventsInWindow(input: {
    readonly eventTypes: readonly string[];
    readonly from: Date;
    readonly to: Date;
    readonly afterId: number | null;
    readonly limit: number;
  }): Promise<readonly AccountingEvent[]>;
}

/** Escapes `%`, `_` and `\` so a prefix matches only itself in LIKE. */
const likePrefix = (prefix: string) => `${prefix.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export class DrizzleBooksHistoryReader implements IBooksHistoryReader {
  constructor(private readonly db: Database) {}

  async paidShopOrders(input: {
    since: Date | null;
    before: Date;
    afterInvoiceNumber: string | null;
    limit: number;
  }): Promise<readonly ShopHistoryOrder[]> {
    const rows = await this.db
      .select({ orderId: shopOrder.id, invoiceNumber: shopOrder.invoiceNumber })
      .from(shopOrder)
      .where(
        and(
          isNotNull(shopOrder.invoiceNumber),
          isNotNull(shopOrder.paidAt),
          lt(shopOrder.paidAt, input.before),
          input.since ? gte(shopOrder.paidAt, input.since) : undefined,
          input.afterInvoiceNumber
            ? gt(shopOrder.invoiceNumber, input.afterInvoiceNumber)
            : undefined,
        ),
      )
      .orderBy(asc(shopOrder.invoiceNumber))
      .limit(input.limit);
    return rows.map((r) => ({ orderId: r.orderId, invoiceNumber: r.invoiceNumber as string }));
  }

  async documentsCreatedOn(sourcePrefix: string, dayStart: Date): Promise<number> {
    const [row] = await this.db
      .select({ n: count() })
      .from(accountingDocument)
      .where(
        and(
          like(accountingDocument.sourceEventRef, likePrefix(sourcePrefix)),
          gte(accountingDocument.createdAt, dayStart),
          lt(accountingDocument.createdAt, new Date(dayStart.getTime() + 86_400_000)),
        ),
      );
    return Number(row?.n ?? 0);
  }

  async eventsInWindow(input: {
    eventTypes: readonly string[];
    from: Date;
    to: Date;
    afterId: number | null;
    limit: number;
  }): Promise<readonly AccountingEvent[]> {
    if (input.eventTypes.length === 0) return [];
    return this.db
      .select({
        id: domainEvent.id,
        eventType: domainEvent.eventType,
        aggregateId: domainEvent.aggregateId,
        payload: domainEvent.payload,
        occurredAt: domainEvent.occurredAt,
      })
      .from(domainEvent)
      .where(
        and(
          inArray(domainEvent.eventType, [...input.eventTypes]),
          gte(domainEvent.occurredAt, input.from),
          lt(domainEvent.occurredAt, input.to),
          input.afterId !== null ? gt(domainEvent.id, input.afterId) : undefined,
        ),
      )
      .orderBy(asc(domainEvent.id))
      .limit(input.limit);
  }
}
