import type { AlertPruneCounts, AlertRetentionCutoffs, AlertRetentionStore } from "@auction/alerts";
import type { Database } from "@auction/db";
import type { AlertTables } from "@auction/db/schema";
import { and, eq, exists, inArray, isNotNull, lt, not, or, sql } from "drizzle-orm";

const DEFAULT_BATCH = 500;

type Options = { dryRun: boolean };

/**
 * Prunes one product's alert engine tables by the retention rules in `@auction/alerts`. Bid and
 * Shop each build one over their own tables and database; nothing here crosses products.
 *
 * Each step deletes in batches, so a large backlog never holds one long lock. A confirmed
 * subscriber is never selected: every subscriber step names its status.
 */
export class DrizzleAlertRetentionStore implements AlertRetentionStore {
  constructor(
    readonly name: string,
    private readonly db: Database,
    private readonly tables: AlertTables,
    private readonly batch = DEFAULT_BATCH,
  ) {}

  async prune(cutoffs: AlertRetentionCutoffs, options: Options): Promise<AlertPruneCounts> {
    // Order matters: logs first, so the digest step sees matches already gone.
    const matches = await this.pruneMatches(cutoffs.logsBefore, options);
    const digests = await this.pruneDigests(cutoffs.logsBefore, options);
    const unconfirmed = await this.pruneUnconfirmed(cutoffs.unconfirmedBefore, options);
    const stopped = await this.pruneStopped(cutoffs.stoppedBefore, options);
    const suppressionsTrimmed = await this.trimSuppressions(cutoffs.stoppedBefore, options);
    return { unconfirmed, stopped, suppressionsTrimmed, matches, digests };
  }

  /** A stopped subscriber's stop time; the last update stands in for a row that has none. */
  private get stoppedAt() {
    const s = this.tables.subscriber;
    return sql<Date>`coalesce(${s.stoppedAt}, ${s.updatedAt})`;
  }

  private get complained() {
    return eq(this.tables.subscriber.stopReason, "complaint");
  }

  private async pruneUnconfirmed(before: Date, { dryRun }: Options): Promise<number> {
    const s = this.tables.subscriber;
    const due = and(eq(s.status, "pending"), lt(s.requestedAt, before));
    return this.deleteSubscribers(due, dryRun);
  }

  private async pruneStopped(before: Date, { dryRun }: Options): Promise<number> {
    const s = this.tables.subscriber;
    // A complaint-stopped row is the alert suppression; it is trimmed, never deleted.
    const due = and(
      eq(s.status, "stopped"),
      sql`${s.stopReason} IS DISTINCT FROM 'complaint'`,
      sql`${this.stoppedAt} < ${before}`,
    );
    return this.deleteSubscribers(due, dryRun);
  }

  private async deleteSubscribers(due: ReturnType<typeof and>, dryRun: boolean): Promise<number> {
    const s = this.tables.subscriber;
    if (dryRun) return this.count(s, due);
    let total = 0;
    for (;;) {
      // Topics, matches and digests go with the subscriber by cascade.
      const rows = await this.db
        .delete(s)
        .where(inArray(s.id, this.db.select({ id: s.id }).from(s).where(due).limit(this.batch)))
        .returning({ id: s.id });
      total += rows.length;
      if (rows.length < this.batch) return total;
    }
  }

  /**
   * A complaint-stopped subscriber keeps its row (address, status, stop reason, consent proof) and
   * loses everything else: topics, matches, digests, and the link to an account.
   */
  private async trimSuppressions(before: Date, { dryRun }: Options): Promise<number> {
    const { subscriber: s, topic, match, digest } = this.tables;
    const hasChildren = or(
      isNotNull(s.subjectId),
      exists(this.db.select({ one: sql`1` }).from(topic).where(eq(topic.subscriberId, s.id))),
      exists(this.db.select({ one: sql`1` }).from(match).where(eq(match.subscriberId, s.id))),
      exists(this.db.select({ one: sql`1` }).from(digest).where(eq(digest.subscriberId, s.id))),
    );
    const due = and(
      eq(s.status, "stopped"),
      this.complained,
      sql`${this.stoppedAt} < ${before}`,
      hasChildren,
    );
    if (dryRun) return this.count(s, due);
    let total = 0;
    for (;;) {
      const ids = (await this.db.select({ id: s.id }).from(s).where(due).limit(this.batch)).map(
        (row) => row.id,
      );
      if (ids.length === 0) return total;
      await this.db.transaction(async (tx) => {
        // Matches first: a digest delete would otherwise null their digest link.
        await tx.delete(match).where(inArray(match.subscriberId, ids));
        await tx.delete(digest).where(inArray(digest.subscriberId, ids));
        await tx.delete(topic).where(inArray(topic.subscriberId, ids));
        await tx.update(s).set({ subjectId: null }).where(inArray(s.id, ids));
      });
      total += ids.length;
    }
  }

  /** Matches that have been mailed (in a sent digest) or dropped; a waiting match is never due. */
  private async pruneMatches(before: Date, { dryRun }: Options): Promise<number> {
    const { match: m, digest: d } = this.tables;
    const due = and(
      lt(m.matchedAt, before),
      or(
        isNotNull(m.droppedReason),
        exists(
          this.db
            .select({ one: sql`1` })
            .from(d)
            .where(and(eq(d.id, m.digestId), isNotNull(d.sentAt))),
        ),
      ),
    );
    if (dryRun) return this.count(m, due);
    let total = 0;
    for (;;) {
      const rows = await this.db
        .delete(m)
        .where(inArray(m.id, this.db.select({ id: m.id }).from(m).where(due).limit(this.batch)))
        .returning({ id: m.id });
      total += rows.length;
      if (rows.length < this.batch) return total;
    }
  }

  /** Sent digests with no match left; an unsent digest is still owed to the person. */
  private async pruneDigests(before: Date, { dryRun }: Options): Promise<number> {
    const { match: m, digest: d } = this.tables;
    const due = and(
      isNotNull(d.sentAt),
      lt(d.createdAt, before),
      not(exists(this.db.select({ one: sql`1` }).from(m).where(eq(m.digestId, d.id)))),
    );
    if (dryRun) return this.count(d, due);
    let total = 0;
    for (;;) {
      const rows = await this.db
        .delete(d)
        .where(inArray(d.id, this.db.select({ id: d.id }).from(d).where(due).limit(this.batch)))
        .returning({ id: d.id });
      total += rows.length;
      if (rows.length < this.batch) return total;
    }
  }

  private async count(
    table: AlertTables["subscriber"] | AlertTables["match"] | AlertTables["digest"],
    where: ReturnType<typeof and>,
  ): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(table as AlertTables["subscriber"])
      .where(where);
    return row?.n ?? 0;
  }
}
