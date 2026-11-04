import type { Database } from "@auction/db";
import { projectorState } from "@auction/db/schema";
import { eq, sql } from "drizzle-orm";

export const BID_ALERT_LOT_START = "bid_alert_lot_matching_start";

/**
 * Where lot matching begins: the newest event when it was first switched on. Lots published
 * before it were never announced and are not now; every lot event after it is matched, however
 * long the worker was down. Set once, by the migration or by the first run, and never moved.
 */
export class BidAlertLotStart {
  constructor(private readonly db: Database) {}

  async position(): Promise<number> {
    await this.db.execute(sql`
      INSERT INTO projector_state (projector_name, last_processed_event_id)
      SELECT ${BID_ALERT_LOT_START}, COALESCE(max(id), 0) FROM domain_events
      ON CONFLICT (projector_name) DO NOTHING`);
    const [row] = await this.db
      .select({ at: projectorState.lastProcessedEventId })
      .from(projectorState)
      .where(eq(projectorState.projectorName, BID_ALERT_LOT_START))
      .limit(1);
    return row?.at ?? 0;
  }
}
