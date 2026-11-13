import type { Database } from "@auction/db";
import { domainEvent, projectorState } from "@auction/db";
import { sql } from "drizzle-orm";

/** Where a new projector's cursor starts. */
export interface IProjectorCursorStart {
  /**
   * Create the projector's cursor at the newest event, if it has none yet: it then follows events
   * from now on and never replays history (a backfill is its own, deliberate command). An existing
   * cursor is left where it is.
   */
  startAtLatestEvent(projectorName: string): Promise<void>;
}

export class DrizzleProjectorCursorStart implements IProjectorCursorStart {
  constructor(private readonly db: Database) {}

  async startAtLatestEvent(projectorName: string): Promise<void> {
    await this.db
      .insert(projectorState)
      .values({
        projectorName,
        lastProcessedEventId: sql`(select coalesce(max(${domainEvent.id}), 0) from ${domainEvent})`,
      })
      .onConflictDoNothing();
  }
}
