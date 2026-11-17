import {
  type AlertProduct,
  type AlertTopic,
  type AnnouncementStore,
  type DigestClaim,
  type DigestLedger,
  type MatchLedger,
  type NewMatch,
  type PendingMatch,
  type UnsentDigest,
  matchSnapshotSchema,
} from "@auction/alerts";
import type { Database } from "@auction/db";
import {
  shopAlertAnnouncement as a,
  shopAlertDigest as d,
  shopAlertMatch as m,
  shopAlertSubscriber as s,
} from "@auction/db/schema";
import { and, asc, eq, gt, inArray, isNull, sql } from "drizzle-orm";

const INSERT_CHUNK = 500;
/** The send log counts release alerts only; back-in-stock and lax.art matches are not counted. */
const RELEASE_TOPIC = "shop.releases";

function toPending(row: {
  id: string;
  subscriberId: string;
  topic: string;
  itemKey: string;
  groupKey: string | null;
  snapshot: unknown;
  matchedAt: Date;
}): PendingMatch {
  return {
    id: row.id,
    subscriberId: row.subscriberId,
    topic: row.topic as AlertTopic,
    itemKey: row.itemKey,
    groupKey: row.groupKey,
    snapshot: matchSnapshotSchema.parse(row.snapshot),
    matchedAt: row.matchedAt,
  };
}

const matchColumns = {
  id: m.id,
  subscriberId: m.subscriberId,
  topic: m.topic,
  itemKey: m.itemKey,
  groupKey: m.groupKey,
  snapshot: m.snapshot,
  matchedAt: m.matchedAt,
};

export class ShopAlertMatchLedger implements MatchLedger {
  constructor(private readonly db: Database) {}

  async record(matches: readonly NewMatch[]) {
    let added = 0;
    for (let i = 0; i < matches.length; i += INSERT_CHUNK) {
      const rows = await this.db
        .insert(m)
        .values(
          matches.slice(i, i + INSERT_CHUNK).map((match) => ({
            subscriberId: match.subscriberId,
            topic: match.topic,
            itemKey: match.itemKey,
            groupKey: match.groupKey,
            snapshot: match.snapshot,
            matchedAt: match.matchedAt,
          })),
        )
        .onConflictDoNothing()
        .returning({ id: m.id });
      added += rows.length;
    }
    return added;
  }

  async pendingSubscribers(product: AlertProduct, after: string | null, limit: number) {
    const rows = await this.db
      .selectDistinct({ subscriberId: m.subscriberId })
      .from(m)
      .innerJoin(s, eq(s.id, m.subscriberId))
      .where(
        and(
          eq(s.product, product),
          isNull(m.digestId),
          isNull(m.droppedReason),
          after ? gt(m.subscriberId, after) : undefined,
        ),
      )
      .orderBy(asc(m.subscriberId))
      .limit(limit);
    return rows.map((r) => r.subscriberId);
  }

  async pendingFor(subscriberId: string) {
    const rows = await this.db
      .select(matchColumns)
      .from(m)
      .where(and(eq(m.subscriberId, subscriberId), isNull(m.digestId), isNull(m.droppedReason)))
      .orderBy(asc(m.matchedAt), asc(m.itemKey));
    return rows.map(toPending);
  }

  /**
   * Drops matches, and counts the release-alert ones on their announcement in the same statement
   * (design LA-3, Q10), so the send log keeps why they were not sent after the matches are gone.
   */
  async drop(matchIds: readonly string[], reason: string, _now: Date) {
    if (matchIds.length === 0) return;
    await this.db.execute(sql`
      WITH dropped AS (
        UPDATE ${m} SET dropped_reason = ${reason}
         WHERE ${m.id} IN (${sql.join(
           matchIds.map((id) => sql`${id}::uuid`),
           sql`, `,
         )}) AND ${m.droppedReason} IS NULL
        RETURNING ${m.itemKey} AS item_key, ${m.topic} AS topic
      ), per_item AS (
        SELECT item_key, count(*)::int AS n FROM dropped
         WHERE topic = ${RELEASE_TOPIC} GROUP BY item_key
      )
      UPDATE ${a} SET
        dropped_count = ${a.droppedCount} + per_item.n,
        dropped_reasons = coalesce(${a.droppedReasons}, '{}'::jsonb)
          || jsonb_build_object(${reason}::text, coalesce((${a.droppedReasons} ->> ${reason}::text)::int, 0) + per_item.n)
        FROM per_item
       WHERE ${a.itemKey} = per_item.item_key AND ${a.droppedCount} IS NOT NULL`);
  }
}

export class ShopAlertDigestLedger implements DigestLedger {
  constructor(private readonly db: Database) {}

  async claim(input: DigestClaim) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(d)
        .values({
          subscriberId: input.subscriberId,
          product: input.product,
          localDate: input.localDate,
          itemCount: input.matchIds.length,
          outboxIdempotencyKey: input.idempotencyKey,
          createdAt: input.now,
        })
        .onConflictDoNothing()
        .returning({ id: d.id });
      if (!row) return null;
      if (input.matchIds.length > 0) {
        await tx
          .update(m)
          .set({ digestId: row.id })
          .where(and(inArray(m.id, [...input.matchIds]), isNull(m.digestId)));
      }
      return { digestId: row.id };
    });
  }

  async matchesOf(digestId: string) {
    const rows = await this.db
      .select(matchColumns)
      .from(m)
      .where(eq(m.digestId, digestId))
      .orderBy(asc(m.matchedAt), asc(m.itemKey));
    return rows.map(toPending);
  }

  async unsent(product: AlertProduct, localDate: string, limit: number): Promise<UnsentDigest[]> {
    return this.db
      .select({
        digestId: d.id,
        subscriberId: d.subscriberId,
        idempotencyKey: d.outboxIdempotencyKey,
      })
      .from(d)
      .where(and(eq(d.product, product), eq(d.localDate, localDate), isNull(d.sentAt)))
      .limit(limit);
  }

  /**
   * Marks a digest sent once, and in the same statement counts its release-alert matches as
   * emailed on their announcements (design LA-3, Q10), so the send log keeps them after the
   * matches are pruned or their subscriber is removed. Marking it again changes nothing.
   */
  async markSent(digestId: string, now: Date) {
    await this.db.execute(sql`
      WITH sent AS (
        UPDATE ${d} SET sent_at = ${now.toISOString()}::timestamptz
         WHERE ${d.id} = ${digestId}::uuid AND ${d.sentAt} IS NULL
        RETURNING ${d.id} AS id
      ), per_item AS (
        SELECT ${m.itemKey} AS item_key, count(*)::int AS n
          FROM ${m} JOIN sent ON ${m.digestId} = sent.id
         WHERE ${m.topic} = ${RELEASE_TOPIC} AND ${m.droppedReason} IS NULL
         GROUP BY ${m.itemKey}
      )
      UPDATE ${a} SET emailed_count = ${a.emailedCount} + per_item.n
        FROM per_item
       WHERE ${a.itemKey} = per_item.item_key AND ${a.emailedCount} IS NOT NULL`);
  }
}

export class ShopAlertAnnouncementStore implements AnnouncementStore {
  constructor(private readonly db: Database) {}

  async claimItem(itemKey: string, announce: boolean, now: Date) {
    const inserted = await this.db
      .insert(a)
      .values({ itemKey, announce, announcedAt: now })
      .onConflictDoNothing()
      .returning({ itemKey: a.itemKey });
    if (inserted.length > 0) return { first: true, announce, expanded: false };
    const [row] = await this.db
      .select({ announce: a.announce, expandedAt: a.expandedAt })
      .from(a)
      .where(eq(a.itemKey, itemKey))
      .limit(1);
    return {
      first: false,
      announce: row?.announce ?? announce,
      expanded: row?.expandedAt != null,
    };
  }

  /** Also keeps how many people the release matched, for the send log (design LA-3, Q10). */
  async markExpanded(itemKey: string, now: Date) {
    await this.db
      .update(a)
      .set({
        expandedAt: now,
        matchedCount: sql`(SELECT count(*)::int FROM ${m} WHERE ${m.itemKey} = ${itemKey} AND ${m.topic} = ${RELEASE_TOPIC})`,
      })
      .where(and(eq(a.itemKey, itemKey), sql`${a.expandedAt} IS NULL`));
  }
}
