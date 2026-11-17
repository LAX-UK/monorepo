import type { Database } from "@auction/db";
import {
  shopAdminAudit,
  shopAlertAnnouncement,
  shopAlertDigest,
  shopAlertMatch,
  shopArtwork,
  shopUserProfile,
} from "@auction/db/schema";
import {
  ADMIN_RELEASE_ALERT_SENDS_MAX_LIMIT,
  type AdminReleaseAlertSend,
} from "@auction/shop-contracts";
import { and, asc, desc, eq, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { artworkItemKey } from "../../application/alerts/alert-items.js";
import type { ReleaseAlertSendLogReader } from "../../application/alerts/alert-ports.js";
import {
  RELEASE_ALERT_STUCK_AFTER_MS,
  releaseAlertSendStatus,
} from "../../application/alerts/release-alert-send-status.js";
import { decodeCatalogueCursor } from "../../application/catalogue-cursor.js";
import { createdAtMicros } from "../admin-created-at-keyset.js";
import { pageOf } from "../drizzle-admin-work-lists.reader.js";
import { shopEditionReleaseSql } from "./shop-alert-catalogue.js";

const DEFAULT_LIMIT = 25;
const RELEASE_TOPIC = "shop.releases";
/** What the publish route writes to the audit log when a work goes on sale. */
const PUBLISH_ACTION = "publish_artwork";
const ARTWORK_TARGET = "shop_artwork";

type ResolveMediaUrl = (value: string | null | undefined) => string | null;

type MatchCounts = {
  matched: number;
  emailed: number;
  notSent: number;
  stuck: boolean;
};

const NO_MATCHES: MatchCounts = { matched: 0, emailed: 0, notSent: 0, stuck: false };

/**
 * The release-alert send log for LAX Admin (design LA-3, L2 and L3): one row per published edition
 * release, newest first, with how many people it matched, how many were emailed, how many wait and
 * how many were dropped. A page costs four queries whatever its size (the page, then counts, drop
 * reasons and publishers for the whole page at once), and nothing about a subscriber leaves here.
 */
export class ReleaseAlertSendLogStore implements ReleaseAlertSendLogReader {
  constructor(
    private readonly db: Database,
    private readonly resolveMediaUrl: ResolveMediaUrl,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(query: { cursor?: string | undefined; limit?: number | undefined }) {
    const limit = Math.min(
      Math.max(query.limit ?? DEFAULT_LIMIT, 1),
      ADMIN_RELEASE_ALERT_SENDS_MAX_LIMIT,
    );
    const rows = await this.page(query.cursor, limit);
    const shown = rows.slice(0, limit);
    const itemKeys = shown.map((row) => row.itemKey);
    const artworkIds = shown.map((row) => row.artworkId);
    const [counts, reasons, publishers] = await Promise.all([
      this.matchCounts(itemKeys),
      this.dropReasons(itemKeys),
      this.publishers(artworkIds),
    ]);
    return pageOf(
      rows,
      limit,
      (row) => ({ createdAt: row.announcedAt, id: row.artworkId, createdAtMicros: row.atMicros }),
      (row): AdminReleaseAlertSend => {
        const c = counts.get(row.itemKey) ?? NO_MATCHES;
        const waiting = Math.max(c.matched - c.emailed - c.notSent, 0);
        const image = this.resolveMediaUrl(row.image);
        return {
          artworkId: row.artworkId,
          title: row.title,
          imageUrl: image && /^https?:\/\//.test(image) ? image : null,
          publishedAt: row.announcedAt.toISOString(),
          publishedByName: publishers.get(row.artworkId) ?? null,
          toldSubscribers: row.announce,
          status: releaseAlertSendStatus({
            announce: row.announce,
            expanded: row.expandedAt !== null,
            waiting,
            stuck: c.stuck,
          }),
          matched: c.matched,
          emailed: c.emailed,
          waiting,
          notSent: c.notSent,
          notSentReasons: reasons.get(row.itemKey) ?? [],
        };
      },
    );
  }

  /** Published edition releases, newest first, one more than the page to know if another follows. */
  private async page(cursorValue: string | undefined, limit: number) {
    const cursor = decodeCatalogueCursor(cursorValue);
    const n = shopAlertAnnouncement;
    const after = cursor
      ? sql`(${n.announcedAt}, ${n.itemKey}) < (${
          cursor.createdAtMicros ?? cursor.createdAt.toISOString()
        }::timestamptz, ${artworkItemKey(cursor.id)})`
      : undefined;
    return this.db
      .select({
        itemKey: n.itemKey,
        announcedAt: n.announcedAt,
        atMicros: createdAtMicros(n.announcedAt),
        announce: n.announce,
        expandedAt: n.expandedAt,
        artworkId: shopArtwork.id,
        title: shopArtwork.title,
        image: shopArtwork.primaryImageUrl,
      })
      .from(n)
      .innerJoin(shopArtwork, sql`${n.itemKey} = 'artwork:' || ${shopArtwork.id}::text`)
      .where(and(shopEditionReleaseSql, after))
      .orderBy(desc(n.announcedAt), desc(n.itemKey))
      .limit(limit + 1);
  }

  /** Matched, emailed and dropped per release, and whether any digest is stuck: one grouped query. */
  private async matchCounts(itemKeys: readonly string[]): Promise<Map<string, MatchCounts>> {
    if (itemKeys.length === 0) return new Map();
    const m = shopAlertMatch;
    const d = shopAlertDigest;
    const stuckBefore = new Date(this.now().getTime() - RELEASE_ALERT_STUCK_AFTER_MS);
    const rows = await this.db
      .select({
        itemKey: m.itemKey,
        matched: sql<number>`count(*)::int`,
        emailed: sql<number>`(count(*) FILTER (WHERE ${d.sentAt} IS NOT NULL AND ${m.droppedReason} IS NULL))::int`,
        notSent: sql<number>`(count(*) FILTER (WHERE ${m.droppedReason} IS NOT NULL))::int`,
        stuck: sql<boolean>`coalesce(bool_or(${d.id} IS NOT NULL AND ${d.sentAt} IS NULL AND ${m.droppedReason} IS NULL AND ${d.createdAt} < ${stuckBefore.toISOString()}::timestamptz), false)`,
      })
      .from(m)
      .leftJoin(d, eq(d.id, m.digestId))
      .where(and(eq(m.topic, RELEASE_TOPIC), inArray(m.itemKey, [...itemKeys])))
      .groupBy(m.itemKey);
    return new Map(
      rows.map((row) => [
        row.itemKey,
        { matched: row.matched, emailed: row.emailed, notSent: row.notSent, stuck: row.stuck },
      ]),
    );
  }

  /** Why matches were dropped, most first, per release. */
  private async dropReasons(itemKeys: readonly string[]) {
    const byItem = new Map<string, { reason: string; count: number }[]>();
    if (itemKeys.length === 0) return byItem;
    const m = shopAlertMatch;
    const total = sql<number>`count(*)::int`;
    const rows = await this.db
      .select({ itemKey: m.itemKey, reason: m.droppedReason, count: total })
      .from(m)
      .where(
        and(
          eq(m.topic, RELEASE_TOPIC),
          inArray(m.itemKey, [...itemKeys]),
          isNotNull(m.droppedReason),
        ),
      )
      .groupBy(m.itemKey, m.droppedReason)
      .orderBy(asc(m.itemKey), desc(total), asc(m.droppedReason));
    for (const row of rows) {
      if (!row.reason) continue;
      const list = byItem.get(row.itemKey) ?? [];
      list.push({ reason: row.reason, count: row.count });
      byItem.set(row.itemKey, list);
    }
    return byItem;
  }

  /**
   * Who published each release, read from the artwork's audit log (design L3: no migration). The
   * announcement is written in the publishing transaction, so the publish entry is the latest one
   * at or before it; a later republish never takes its place.
   */
  private async publishers(artworkIds: readonly string[]): Promise<Map<string, string | null>> {
    if (artworkIds.length === 0) return new Map();
    const a = shopAdminAudit;
    const n = shopAlertAnnouncement;
    const rows = await this.db
      .selectDistinctOn([a.targetId], { artworkId: a.targetId, name: shopUserProfile.name })
      .from(a)
      .innerJoin(n, sql`${n.itemKey} = 'artwork:' || ${a.targetId}`)
      .leftJoin(shopUserProfile, eq(shopUserProfile.identitySubjectId, a.actorSubjectId))
      .where(
        and(
          eq(a.targetType, ARTWORK_TARGET),
          eq(a.action, PUBLISH_ACTION),
          inArray(a.targetId, [...artworkIds]),
          lte(a.createdAt, n.announcedAt),
        ),
      )
      .orderBy(asc(a.targetId), desc(a.createdAt), desc(a.id));
    return new Map(rows.map((row) => [row.artworkId, row.name?.trim() || null]));
  }
}
