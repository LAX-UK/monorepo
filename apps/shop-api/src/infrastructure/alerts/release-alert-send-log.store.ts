import type { Database } from "@auction/db";
import {
  shopAlertAnnouncement,
  shopAlertDigest,
  shopAlertMatch,
  shopArtwork,
  shopUserProfile,
} from "@auction/db/schema";
import {
  ADMIN_RELEASE_ALERT_SENDS_MAX_LIMIT,
  type AdminReleaseAlertSend,
  RELEASE_ALERT_REMOVED_BEFORE_SENDING,
} from "@auction/shop-contracts";
import { and, asc, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { artworkItemKey } from "../../application/alerts/alert-items.js";
import type { ReleaseAlertSendLogReader } from "../../application/alerts/alert-ports.js";
import {
  RELEASE_ALERT_STUCK_AFTER_MS,
  releaseAlertSendStatus,
} from "../../application/alerts/release-alert-send-status.js";
import { decodeCatalogueCursor } from "../../application/catalogue-cursor.js";
import { createdAtMicros, pageOf } from "../admin-created-at-keyset.js";

const DEFAULT_LIMIT = 25;
const RELEASE_TOPIC = "shop.releases";

type ResolveMediaUrl = (value: string | null | undefined) => string | null;

type LiveCounts = {
  matched: number;
  emailed: number;
  notSent: number;
  waiting: number;
  stuck: boolean;
};

type Reason = { reason: string; count: number };

const NO_MATCHES: LiveCounts = { matched: 0, emailed: 0, notSent: 0, waiting: 0, stuck: false };

type PageRow = Awaited<ReturnType<ReleaseAlertSendLogStore["page"]>>[number];

/**
 * Whether a release's counts were kept on its announcement from the start (migration 0405): the
 * counters exist, and the matched figure was taken when it expanded. Rows from before 0405, or
 * expanded by a release that predates it, read their counts from the matches that are left.
 */
function countsKept(row: PageRow): boolean {
  return (
    row.emailedCount !== null &&
    row.droppedCount !== null &&
    (row.matchedCount !== null || row.expandedAt === null)
  );
}

function byCountThenReason(a: Reason, b: Reason) {
  return b.count - a.count || a.reason.localeCompare(b.reason);
}

/**
 * The release-alert send log for LAX Admin (design LA-3, L2 and L3): one row per published edition
 * release, newest first, with how many people it matched, how many were emailed, how many wait and
 * how many were not sent.
 *
 * Matched, emailed and not-sent figures come from the announcement, where they are kept as each
 * match settles (Q10), so they stay true after the 90-day match prune and after a subscriber is
 * pruned or erased. A match whose subscriber was removed before it was sent is counted as not sent,
 * with its own reason. Waiting and stuck come from the matches still open. Rows from before the
 * counts were kept say so (`countsKept: false`) and never read as a confident "Sent".
 *
 * A page costs two queries whatever its size (the page with its publisher, then the open matches
 * for the whole page), plus one for drop reasons when the page holds rows from before 0405. Nothing
 * about a subscriber leaves here.
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
    const legacyKeys = shown.filter((row) => !countsKept(row)).map((row) => row.itemKey);
    const [live, legacyReasons] = await Promise.all([
      this.liveCounts(shown.map((row) => row.itemKey)),
      this.dropReasons(legacyKeys),
    ]);
    return pageOf(
      rows,
      limit,
      (row) => ({ createdAt: row.announcedAt, id: row.artworkId, createdAtMicros: row.atMicros }),
      (row): AdminReleaseAlertSend => {
        const open = live.get(row.itemKey) ?? NO_MATCHES;
        const kept = countsKept(row);
        const counts = kept
          ? this.keptCounts(row, open.waiting)
          : {
              matched: open.matched,
              emailed: open.emailed,
              notSent: open.notSent,
              waiting: open.waiting,
              reasons: legacyReasons.get(row.itemKey) ?? [],
            };
        const image = this.resolveMediaUrl(row.image);
        return {
          artworkId: row.artworkId,
          title: row.title,
          imageUrl: image && /^https?:\/\//.test(image) ? image : null,
          publishedAt: row.announcedAt.toISOString(),
          publishedByName: row.publisherName?.trim() || null,
          toldSubscribers: row.announce,
          status: releaseAlertSendStatus({
            announce: row.announce,
            expanded: row.expandedAt !== null,
            waiting: counts.waiting,
            stuck: open.stuck,
            countsKept: kept,
          }),
          countsKept: kept,
          matched: counts.matched,
          emailed: counts.emailed,
          waiting: counts.waiting,
          notSent: counts.notSent,
          notSentReasons: counts.reasons,
        };
      },
    );
  }

  /**
   * Counts kept on the announcement. Whatever was matched and is neither emailed, dropped nor still
   * waiting had its subscriber removed (pruned or erased) before it went: not sent, and said why.
   */
  private keptCounts(row: PageRow, waiting: number) {
    const emailed = row.emailedCount ?? 0;
    const dropped = row.droppedCount ?? 0;
    const matched = Math.max(row.matchedCount ?? 0, emailed + dropped + waiting);
    const removed = matched - emailed - dropped - waiting;
    const reasons: Reason[] = Object.entries(row.droppedReasons ?? {})
      .filter(([, count]) => count > 0)
      .map(([reason, count]) => ({ reason, count }));
    if (removed > 0) reasons.push({ reason: RELEASE_ALERT_REMOVED_BEFORE_SENDING, count: removed });
    return {
      matched,
      emailed,
      notSent: dropped + removed,
      waiting,
      reasons: reasons.sort(byCountThenReason),
    };
  }

  /**
   * Shop releases, newest first, one more than the page to know if another follows. A release is
   * listed by what the work was when it was published (`kind`), so changing its flags later never
   * takes it out of the log. The publisher is the subject kept on the announcement, named through
   * the profile's primary key: no audit lookup.
   *
   * A release with no `kind` was announced by a build from before 0405 after the migration's one-off
   * backfill ran (the deploy overlap). It is read through the current-flags rule the backfill used,
   * so it still appears; its publisher was never kept, so it reads as unknown.
   */
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
        matchedCount: n.matchedCount,
        emailedCount: n.emailedCount,
        droppedCount: n.droppedCount,
        droppedReasons: n.droppedReasons,
        artworkId: shopArtwork.id,
        title: shopArtwork.title,
        image: shopArtwork.primaryImageUrl,
        publisherName: shopUserProfile.name,
      })
      .from(n)
      .innerJoin(shopArtwork, sql`${n.itemKey} = 'artwork:' || ${shopArtwork.id}::text`)
      .leftJoin(shopUserProfile, eq(shopUserProfile.identitySubjectId, n.announcedBy))
      .where(
        and(
          or(
            eq(n.kind, "shop_release"),
            and(
              isNull(n.kind),
              eq(shopArtwork.salesChannel, "shop"),
              eq(shopArtwork.eligibleForEditionAllocation, true),
            ),
          ),
          after,
        ),
      )
      .orderBy(desc(n.announcedAt), desc(n.itemKey))
      .limit(limit + 1);
  }

  /**
   * The matches still kept for the page's releases, in one grouped query on the item index:
   * matched, emailed and dropped (used for rows from before 0405), waiting, and whether any sits in
   * a digest still unsent past the stuck threshold.
   */
  private async liveCounts(itemKeys: readonly string[]): Promise<Map<string, LiveCounts>> {
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
        waiting: sql<number>`(count(*) FILTER (WHERE ${m.droppedReason} IS NULL AND ${d.sentAt} IS NULL))::int`,
        stuck: sql<boolean>`coalesce(bool_or(${d.id} IS NOT NULL AND ${d.sentAt} IS NULL AND ${m.droppedReason} IS NULL AND ${d.createdAt} < ${stuckBefore.toISOString()}::timestamptz), false)`,
      })
      .from(m)
      .leftJoin(d, eq(d.id, m.digestId))
      .where(and(inArray(m.itemKey, [...itemKeys]), eq(m.topic, RELEASE_TOPIC)))
      .groupBy(m.itemKey);
    return new Map(
      rows.map((row) => [
        row.itemKey,
        {
          matched: row.matched,
          emailed: row.emailed,
          notSent: row.notSent,
          waiting: row.waiting,
          stuck: row.stuck,
        },
      ]),
    );
  }

  /** Why matches were dropped, most first, for releases from before the reasons were kept. */
  private async dropReasons(itemKeys: readonly string[]) {
    const byItem = new Map<string, Reason[]>();
    if (itemKeys.length === 0) return byItem;
    const m = shopAlertMatch;
    const total = sql<number>`count(*)::int`;
    const rows = await this.db
      .select({ itemKey: m.itemKey, reason: m.droppedReason, count: total })
      .from(m)
      .where(
        and(
          inArray(m.itemKey, [...itemKeys]),
          eq(m.topic, RELEASE_TOPIC),
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
}
