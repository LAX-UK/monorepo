import { type Database, lotNotDeleted } from "@auction/db";
import {
  bidInvoice,
  buyerDefault,
  lot,
  lotReoffer,
  payment,
  sellerConsent,
} from "@auction/db/schema";
import { INVOICE_RETRY_PREFIX } from "@auction/domain";
import {
  and,
  asc,
  desc,
  eq,
  isNotNull,
  isNull,
  like,
  lt,
  ne,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import type {
  IReofferInvoiceMarker,
  IReofferSweepReader,
  ReofferSweepRef,
} from "../interfaces/reoffer-sweep.js";

/** The listings the clock sweeps start from. Each is a pointer; the sweeps re-read under locks. */
export class DrizzleReofferSweepReader implements IReofferSweepReader {
  constructor(private readonly db: Database) {}

  async latestDefaultId(db: Database, lotId: string): Promise<string | null> {
    const [row] = await db
      .select({ id: buyerDefault.id })
      .from(buyerDefault)
      .where(eq(buyerDefault.lotId, lotId))
      .orderBy(desc(buyerDefault.createdAt), desc(buyerDefault.id))
      .limit(1);
    return row?.id ?? null;
  }

  async openSellerRequests(limit: number): Promise<ReofferSweepRef[]> {
    const rows = await this.db
      .select({ reofferId: lotReoffer.id, lotId: lotReoffer.lotId })
      .from(lotReoffer)
      .innerJoin(sellerConsent, eq(sellerConsent.id, lotReoffer.sellerConsentId))
      .where(and(eq(lotReoffer.status, "awaiting_seller"), eq(sellerConsent.status, "requested")))
      .orderBy(asc(sellerConsent.dueAt), asc(lotReoffer.id))
      .limit(limit);
    return rows;
  }

  async offersOut(limit: number): Promise<ReofferSweepRef[]> {
    return this.db
      .select({ reofferId: lotReoffer.id, lotId: lotReoffer.lotId })
      .from(lotReoffer)
      .where(eq(lotReoffer.status, "offered"))
      .orderBy(asc(lotReoffer.offerEndsAt), asc(lotReoffer.id))
      .limit(limit);
  }

  async acceptedWithoutInvoice(input: {
    reawardedBefore: Date;
    retryMarkedBefore: Date;
    limit: number;
  }): Promise<ReofferSweepRef[]> {
    return this.db
      .select({ reofferId: lotReoffer.id, lotId: lotReoffer.lotId })
      .from(lotReoffer)
      .innerJoin(lot, eq(lot.id, lotReoffer.lotId))
      .where(
        and(
          eq(lotReoffer.status, "accepted"),
          isNotNull(lotReoffer.reawardedAt),
          lt(lotReoffer.reawardedAt, input.reawardedBefore),
          // The award still stands: the bidder is the lot's winner and this is its latest default.
          lotNotDeleted(),
          eq(lot.status, "ended"),
          eq(lot.winnerId, lotReoffer.offeredUserId),
          // The account the invoice would be raised to is the one the offer went to.
          eq(lot.buyerLegalEntityId, lotReoffer.offeredLegalEntityId),
          // Not already tried and found unraisable for good, nor tried too recently to try again
          // (see `DrizzleReofferInvoiceMarker`).
          or(
            isNull(lotReoffer.closeReason),
            and(
              like(lotReoffer.closeReason, `${INVOICE_RETRY_PREFIX}%`),
              lt(lotReoffer.updatedAt, input.retryMarkedBefore),
            ),
          ),
          sql`${lotReoffer.buyerDefaultId} = (
            select ${buyerDefault.id} from ${buyerDefault}
             where ${buyerDefault.lotId} = ${lotReoffer.lotId}
             order by ${buyerDefault.createdAt} desc, ${buyerDefault.id} desc
             limit 1)`,
          // No payment of this account stands for an invoice on the lot. Every payment does, whatever
          // its status (a buyer who relinquished, a stale checkout that was cancelled, a refund),
          // except a cancelled one whose invoice was voided: only a buyer default voids an invoice,
          // and that one is the earlier award the re-award replaced. A cancelled payment with no
          // invoice, or a live invoice, still counts, so an unclear row is never re-invoiced.
          notExists(
            this.db
              .select({ id: payment.id })
              .from(payment)
              .leftJoin(bidInvoice, eq(bidInvoice.id, payment.invoiceId))
              .where(
                and(
                  eq(payment.lotId, lotReoffer.lotId),
                  eq(payment.buyerLegalEntityId, lotReoffer.offeredLegalEntityId),
                  or(ne(payment.status, "cancelled"), isNull(bidInvoice.voidedAt)),
                ),
              ),
          ),
        ),
      )
      .orderBy(asc(lotReoffer.reawardedAt), asc(lotReoffer.id))
      .limit(input.limit);
  }
}

/**
 * Marks an accepted offer whose invoice was not raised, in `close_reason` (an accepted offer is
 * not closed, so the column is free and the worker already holds UPDATE on it). A terminal marker
 * keeps the offer out of the listing for good; a retry marker (`invoice_not_raised:retry:…`) and
 * its `updated_at` keep it out for the back-off only. A terminal marker is never overwritten.
 */
export class DrizzleReofferInvoiceMarker implements IReofferInvoiceMarker {
  constructor(private readonly db: Database) {}

  async markInvoiceNotRaised(reofferId: string, marker: string): Promise<boolean> {
    const rows = await this.db
      .update(lotReoffer)
      .set({ closeReason: marker, updatedAt: new Date() })
      .where(
        and(
          eq(lotReoffer.id, reofferId),
          eq(lotReoffer.status, "accepted"),
          or(
            isNull(lotReoffer.closeReason),
            like(lotReoffer.closeReason, `${INVOICE_RETRY_PREFIX}%`),
          ),
        ),
      )
      .returning({ id: lotReoffer.id });
    return rows.length > 0;
  }
}
