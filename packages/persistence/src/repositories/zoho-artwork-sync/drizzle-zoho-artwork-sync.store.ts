import type { Database } from "@auction/db";
import { zohoArtworkSyncOutcome as outcomeTable, zohoArtworkSyncState } from "@auction/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import type {
  IZohoArtworkSyncReport,
  IZohoArtworkSyncWatermark,
  ZohoArtworkSyncMode,
  ZohoArtworkSyncOutcome,
  ZohoArtworkSyncOutcomeInput,
  ZohoArtworkSyncSummary,
} from "../../interfaces/zoho-artwork-sync.js";

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
  implements IZohoArtworkSyncWatermark, IZohoArtworkSyncReport
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
}
