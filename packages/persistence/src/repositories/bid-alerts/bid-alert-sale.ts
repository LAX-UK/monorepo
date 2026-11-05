import type { MatchValidator, PendingMatch } from "@auction/alerts";
import type { Database } from "@auction/db";
import {
  bidAlertAnnouncement,
  bidAlertSubscriber,
  bidAlertTopic,
  domainEvent,
  notification,
  notificationPreference,
  projectorState,
  sale,
} from "@auction/db/schema";
import { and, eq, inArray, isNotNull, max, ne, sql } from "drizzle-orm";
import type {
  AnnouncedSale,
  IBidAlertSaleNoticeWriter,
  IBidAlertSaleReader,
} from "../../interfaces/bid-alert-sale.js";

const SALE_PREFIX = "sale:";
/** The sales a digest may still announce: not a draft again, cancelled, or already over. */
const ANNOUNCEABLE = ["scheduled", "active"] as const;

/** Bid's own reads for the new-sale alert: the sale behind an item, and who is told in the app. */
export class BidAlertSaleReader implements IBidAlertSaleReader {
  constructor(private readonly db: Database) {}

  async find(saleId: string): Promise<AnnouncedSale | null> {
    const [row] = await this.db
      .select({
        id: sale.id,
        title: sale.title,
        startTime: sale.startTime,
        endTime: sale.endTime,
        status: sale.status,
        deliveryMode: sale.deliveryMode,
        isTest: sale.isTest,
      })
      .from(sale)
      .where(eq(sale.id, saleId))
      .limit(1);
    return row ?? null;
  }

  /** Confirmed subscribers with new-sale email on: the count shown beside the publish box. */
  async countEmailSubscribers(): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(bidAlertTopic)
      .innerJoin(bidAlertSubscriber, eq(bidAlertSubscriber.id, bidAlertTopic.subscriberId))
      .where(
        and(
          eq(bidAlertTopic.topic, "bid.new_sales"),
          eq(bidAlertTopic.emailOn, true),
          eq(bidAlertSubscriber.status, "confirmed"),
        ),
      );
    return row?.n ?? 0;
  }
}

/**
 * Drops a new-sale match whose sale was withdrawn, cancelled or has ended by digest time, or that
 * was marked as a test sale after it was matched.
 */
export class BidAlertMatchValidator implements MatchValidator {
  constructor(private readonly db: Database) {}

  async staleMatches(matches: readonly PendingMatch[]): Promise<Map<string, string>> {
    const saleIdOf = (m: PendingMatch) =>
      m.itemKey.startsWith(SALE_PREFIX) ? m.itemKey.slice(SALE_PREFIX.length) : null;
    const ids = [...new Set(matches.map(saleIdOf).filter((id): id is string => id !== null))];
    if (ids.length === 0) return new Map();
    const live = await this.db
      .select({ id: sale.id })
      .from(sale)
      .where(
        and(inArray(sale.id, ids), inArray(sale.status, [...ANNOUNCEABLE]), eq(sale.isTest, false)),
      );
    const liveIds = new Set(live.map((r) => r.id));
    const stale = new Map<string, string>();
    for (const match of matches) {
      const saleId = saleIdOf(match);
      if (saleId && !liveIds.has(saleId)) stale.set(match.id, "sale_withdrawn");
    }
    return stale;
  }
}

/** The in-app notice for a new sale: one per signed-in subscriber whose app switch is on. */
export class BidAlertSaleNoticeWriter implements IBidAlertSaleNoticeWriter {
  constructor(private readonly db: Database) {}

  /** Idempotent: a person is told once per sale, so a retried announcement adds nothing. */
  async notifySubscribers(input: {
    saleId: string;
    title: string;
    message: string;
  }): Promise<number> {
    const result = await this.db.execute(sql`
      INSERT INTO ${notification} (user_id, type, title, message, sale_id)
      SELECT s.user_id, 'sale_announced', ${input.title}, ${input.message}, ${input.saleId}::uuid
      FROM ${bidAlertSubscriber} s
      JOIN ${bidAlertTopic} t ON t.subscriber_id = s.id AND t.topic = 'bid.new_sales'
      LEFT JOIN ${notificationPreference} p ON p.user_id = s.user_id
      WHERE s.status = 'confirmed'
        AND s.user_id IS NOT NULL
        AND COALESCE(p.new_sales_in_app, true)
        AND NOT EXISTS (
          SELECT 1 FROM ${notification} n
          WHERE n.user_id = s.user_id AND n.type = 'sale_announced' AND n.sale_id = ${input.saleId}::uuid
        )
    `);
    return result.rowCount ?? 0;
  }
}

export const BID_ALERT_SEED_KEY = "seed:bid";

/**
 * The first-run seed: every sale already published counts as announced, and the matching projector
 * starts from the newest event, so switching alerts on never announces anything old.
 */
export class BidAlertSeed {
  constructor(private readonly db: Database) {}

  async isSeeded(): Promise<boolean> {
    const [row] = await this.db
      .select({ key: bidAlertAnnouncement.itemKey })
      .from(bidAlertAnnouncement)
      .where(eq(bidAlertAnnouncement.itemKey, BID_ALERT_SEED_KEY))
      .limit(1);
    return row !== undefined;
  }

  async run(
    projectorName: string,
    now: Date,
  ): Promise<{ alreadyAnnounced: number; cursor: number; alreadySeeded: boolean }> {
    return this.db.transaction(async (tx) => {
      const marker = await tx
        .insert(bidAlertAnnouncement)
        .values({ itemKey: BID_ALERT_SEED_KEY, announce: false, announcedAt: now, expandedAt: now })
        .onConflictDoNothing()
        .returning({ key: bidAlertAnnouncement.itemKey });
      if (marker.length === 0) return { alreadyAnnounced: 0, cursor: 0, alreadySeeded: true };

      const published = await tx
        .select({ id: sale.id })
        .from(sale)
        .where(and(ne(sale.status, "draft"), isNotNull(sale.id)));
      // Test sales are included on purpose: marked as announced, they can never be announced later.
      let alreadyAnnounced = 0;
      for (let i = 0; i < published.length; i += 500) {
        const rows = await tx
          .insert(bidAlertAnnouncement)
          .values(
            published.slice(i, i + 500).map((r) => ({
              itemKey: `${SALE_PREFIX}${r.id}`,
              announce: false,
              announcedAt: now,
              expandedAt: now,
            })),
          )
          .onConflictDoNothing()
          .returning({ key: bidAlertAnnouncement.itemKey });
        alreadyAnnounced += rows.length;
      }
      const [newest] = await tx.select({ id: max(domainEvent.id) }).from(domainEvent);
      const cursor = newest?.id ?? 0;
      await tx
        .insert(projectorState)
        .values({ projectorName, lastProcessedEventId: cursor })
        .onConflictDoUpdate({
          target: projectorState.projectorName,
          set: { lastProcessedEventId: cursor, updatedAt: now },
        });
      return { alreadyAnnounced, cursor, alreadySeeded: false };
    });
  }
}
