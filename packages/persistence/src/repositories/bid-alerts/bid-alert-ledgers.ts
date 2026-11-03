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
  bidAlertAnnouncement as a,
  bidAlertDigest as d,
  bidAlertMatch as m,
  bidAlertSubscriber as s,
} from "@auction/db/schema";
import { and, asc, eq, gt, inArray, isNull, sql } from "drizzle-orm";

const INSERT_CHUNK = 500;

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

export class BidAlertMatchLedger implements MatchLedger {
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

  async drop(matchIds: readonly string[], reason: string, _now: Date) {
    if (matchIds.length === 0) return;
    await this.db
      .update(m)
      .set({ droppedReason: reason })
      .where(and(inArray(m.id, [...matchIds]), isNull(m.droppedReason)));
  }
}

export class BidAlertDigestLedger implements DigestLedger {
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

  async markSent(digestId: string, now: Date) {
    await this.db.update(d).set({ sentAt: now }).where(eq(d.id, digestId));
  }
}

export class BidAlertAnnouncementStore implements AnnouncementStore {
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

  async markExpanded(itemKey: string, now: Date) {
    await this.db
      .update(a)
      .set({ expandedAt: now })
      .where(and(eq(a.itemKey, itemKey), sql`${a.expandedAt} IS NULL`));
  }
}
