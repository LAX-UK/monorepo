import type { Database } from "@auction/db";
import { coverAnalysis } from "@auction/db";
import type { SaleCoverSlot, SaleCoverSlotName } from "@auction/types";
import { SALE_COVER_SLOT_NAMES } from "@auction/types";
import { sql } from "drizzle-orm";
import type {
  CoverAnalysisOutcome,
  ICoverAnalysisJobRepository,
  PendingCoverSlot,
} from "../interfaces/cover-analysis-job.repository.js";

type PendingRow = { sale_id: string; slot_name: string; slot: SaleCoverSlot };

const isSlotName = (value: string): value is SaleCoverSlotName =>
  (SALE_COVER_SLOT_NAMES as readonly string[]).includes(value);

/** Finds cover slots to measure and keeps what was measured, in `cover_analysis`. */
export class DrizzleCoverAnalysisJobRepository implements ICoverAnalysisJobRepository {
  constructor(private readonly db: Database) {}

  async listPending(limit: number): Promise<PendingCoverSlot[]> {
    const result = await this.db.execute<PendingRow>(sql`
      select s.id as sale_id, slot.key as slot_name, slot.value as slot
      from sale s
      cross join lateral jsonb_each(s.cover_slots) as slot
      where s.deleted_at is null
        and slot.value ->> 'analysisHash' is not null
        and not exists (
          select 1 from cover_analysis a where a.hash = slot.value ->> 'analysisHash'
        )
      order by s.updated_at desc
      limit ${limit}
    `);
    const seen = new Set<string>();
    const pending: PendingCoverSlot[] = [];
    for (const row of result.rows) {
      if (!isSlotName(row.slot_name) || seen.has(row.slot.analysisHash)) continue;
      seen.add(row.slot.analysisHash);
      pending.push({ saleId: row.sale_id, name: row.slot_name, slot: row.slot });
    }
    return pending;
  }

  async save(hash: string, outcome: CoverAnalysisOutcome): Promise<void> {
    const analysis = outcome.status === "ready" ? outcome.analysis : null;
    await this.db
      .insert(coverAnalysis)
      .values({ hash, status: outcome.status, analysis })
      .onConflictDoUpdate({
        target: coverAnalysis.hash,
        set: { status: outcome.status, analysis, analysedAt: new Date() },
      });
  }
}
