import type { Database } from "@auction/db";
import { zohoArtworkSyncOutcome as outcomeTable, zohoArtworkSyncState } from "@auction/db/schema";
import { and, asc, desc, eq, like, sql } from "drizzle-orm";
import type {
  IZohoArtworkSyncReport,
  IZohoArtworkSyncRunReader,
  IZohoArtworkSyncWatermark,
  ZohoArtworkSyncMode,
  ZohoArtworkSyncOutcome,
  ZohoArtworkSyncOutcomeInput,
  ZohoArtworkSyncRunSummary,
  ZohoArtworkSyncSummary,
} from "../../interfaces/zoho-artwork-sync.js";
import { rowsOf } from "../rows-of.js";

const EMPTY_SUMMARY: ZohoArtworkSyncSummary = {
  create: 0,
  update: 0,
  conflict: 0,
  unchanged: 0,
  stale: 0,
  skipped: 0,
};

/** The watermark and the per-Product report of the Zoho artwork sync. */
export class DrizzleZohoArtworkSyncStore
  implements IZohoArtworkSyncWatermark, IZohoArtworkSyncReport, IZohoArtworkSyncRunReader
{
  constructor(private readonly db: Database) {}

  async get(mode: ZohoArtworkSyncMode): Promise<Date | null> {
    const [row] = await this.db
      .select({ watermark: zohoArtworkSyncState.watermark })
      .from(zohoArtworkSyncState)
      .where(eq(zohoArtworkSyncState.mode, mode))
      .limit(1);
    return row?.watermark ?? null;
  }

  async advance(mode: ZohoArtworkSyncMode, to: Date, now: Date): Promise<void> {
    await this.db
      .insert(zohoArtworkSyncState)
      .values({ mode, watermark: to, updatedAt: now })
      .onConflictDoUpdate({
        target: zohoArtworkSyncState.mode,
        set: {
          watermark: sql`GREATEST(${zohoArtworkSyncState.watermark}, excluded.watermark)`,
          updatedAt: now,
        },
      });
  }

  async record(
    runId: string,
    mode: ZohoArtworkSyncMode,
    outcomes: readonly ZohoArtworkSyncOutcomeInput[],
    now: Date,
  ): Promise<void> {
    if (outcomes.length === 0) return;
    await this.db
      .insert(outcomeTable)
      .values(
        outcomes.map((o) => ({
          runId,
          mode,
          zohoProductId: o.zohoProductId,
          stockCode: o.stockCode,
          title: o.title,
          outcome: o.outcome,
          reason: o.reason,
          detail: o.detail,
          zohoModifiedAt: o.zohoModifiedAt,
          recordedAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: [outcomeTable.runId, outcomeTable.zohoProductId],
        set: {
          mode: sql`excluded.mode`,
          stockCode: sql`excluded.stock_code`,
          title: sql`excluded.title`,
          outcome: sql`excluded.outcome`,
          reason: sql`excluded.reason`,
          detail: sql`excluded.detail`,
          zohoModifiedAt: sql`excluded.zoho_modified_at`,
          recordedAt: sql`excluded.recorded_at`,
        },
      });
  }

  async listForRun(runId: string, limit: number): Promise<ZohoArtworkSyncOutcome[]> {
    const rows = await this.db
      .select()
      .from(outcomeTable)
      .where(eq(outcomeTable.runId, runId))
      .orderBy(asc(outcomeTable.zohoModifiedAt), asc(outcomeTable.id))
      .limit(limit);
    return rows.map((row) => ({
      id: row.id,
      runId: row.runId,
      mode: row.mode,
      zohoProductId: row.zohoProductId,
      stockCode: row.stockCode,
      title: row.title,
      outcome: row.outcome,
      reason: row.reason,
      detail: row.detail,
      zohoModifiedAt: row.zohoModifiedAt,
      recordedAt: row.recordedAt,
    }));
  }

  async summarise(runId: string): Promise<ZohoArtworkSyncSummary> {
    const rows = await this.db
      .select({ outcome: outcomeTable.outcome, count: sql<number>`count(*)::int` })
      .from(outcomeTable)
      .where(eq(outcomeTable.runId, runId))
      .groupBy(outcomeTable.outcome);
    const summary = { ...EMPTY_SUMMARY };
    for (const row of rows) summary[row.outcome] = row.count;
    return summary;
  }

  async latestNightlyRun(): Promise<ZohoArtworkSyncRunSummary | null> {
    const [latest] = await this.db
      .select({ runId: outcomeTable.runId, mode: outcomeTable.mode })
      .from(outcomeTable)
      .where(like(outcomeTable.runId, "nightly:%"))
      .orderBy(desc(outcomeTable.recordedAt), desc(outcomeTable.id))
      .limit(1);
    if (!latest) return null;

    const inRun = eq(outcomeTable.runId, latest.runId);
    const [byOutcome, finished, skipped, gaps] = await Promise.all([
      this.summarise(latest.runId),
      this.db
        .select({ at: sql<Date>`max(${outcomeTable.recordedAt})` })
        .from(outcomeTable)
        .where(inRun),
      this.db
        .select({ reason: outcomeTable.reason, count: sql<number>`count(*)::int` })
        .from(outcomeTable)
        .where(and(inRun, eq(outcomeTable.outcome, "skipped")))
        .groupBy(outcomeTable.reason)
        .orderBy(sql`count(*) DESC`, asc(outcomeTable.reason)),
      this.createGaps(latest.runId),
    ]);
    const total = Object.values(byOutcome).reduce((sum, n) => sum + n, 0);
    return {
      runId: latest.runId,
      mode: latest.mode,
      finishedAt: new Date(finished[0]?.at ?? 0),
      total,
      byOutcome,
      skippedReasons: skipped.map((row) => ({ reason: row.reason ?? "unknown", count: row.count })),
      gaps,
    };
  }

  /** What Products that would be created lack, from the gaps each result recorded. */
  private async createGaps(runId: string): Promise<{ gap: string; count: number }[]> {
    const result = await this.db.execute(sql`
      SELECT g.gap AS gap, count(*)::int AS count
      FROM zoho_artwork_sync_outcome o,
        LATERAL jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(o.detail -> 'gaps') = 'array' THEN o.detail -> 'gaps' ELSE '[]'::jsonb END
        ) AS g(gap)
      WHERE o.run_id = ${runId} AND o.outcome = 'create'
      GROUP BY g.gap
      ORDER BY count(*) DESC, g.gap
    `);
    return rowsOf<{ gap: string; count: number }>(result);
  }
}
