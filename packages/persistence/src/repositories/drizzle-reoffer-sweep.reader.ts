import { type Database, lotNotDeleted } from "@auction/db";
import { buyerDefault, lot, lotReoffer, payment, sellerConsent } from "@auction/db/schema";
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, notExists, sql } from "drizzle-orm";
import type {
  IReofferInvoiceMarker,
  IReofferSweepReader,
  ReofferSweepRef,
} from "../interfaces/reoffer-sweep.js";

/** Payments that stand for an invoice: the ones `ensureForLot` itself treats as one. */
const LIVE_PAYMENT_STATUSES = [
  "pending",
  "authorized",
  "captured",
  "requires_manual_review",
  "refunded",
] as const;

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
          // Not already tried and found unraisable (see `DrizzleReofferInvoiceMarker`).
          isNull(lotReoffer.closeReason),
          sql`${lotReoffer.buyerDefaultId} = (
            select ${buyerDefault.id} from ${buyerDefault}
             where ${buyerDefault.lotId} = ${lotReoffer.lotId}
             order by ${buyerDefault.createdAt} desc, ${buyerDefault.id} desc
             limit 1)`,
          notExists(
            this.db
              .select({ id: payment.id })
              .from(payment)
              .where(
                and(
                  eq(payment.lotId, lotReoffer.lotId),
                  eq(payment.buyerLegalEntityId, lotReoffer.offeredLegalEntityId),
                  inArray(payment.status, [...LIVE_PAYMENT_STATUSES]),
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
 * Marks an accepted offer whose invoice cannot be raised, in `close_reason` (an accepted offer is
 * not closed, so the column is free and the worker already holds UPDATE on it). The listing skips
 * marked offers, so one dead row is reported once and does not crowd out new missed invoices.
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
          isNull(lotReoffer.closeReason),
        ),
      )
      .returning({ id: lotReoffer.id });
    return rows.length > 0;
  }
}
