import type { Database } from "@auction/db";
import { domainEvent, projectorState } from "@auction/db";
import { sql } from "drizzle-orm";

/** Where a projector's cursor starts, and how it skips the events it must not project. */
export interface IProjectorCursorStart {
  /**
   * Create the projector's cursor at the newest event, if it has none yet: it then follows events
   * from now on and never replays history (a backfill is its own, deliberate command). An existing
   * cursor is left where it is.
   */
  startAtLatestEvent(projectorName: string): Promise<void>;
  /**
   * Move the projector's cursor to the newest event (creating it there if it has none), never
   * backwards. Called on every tick the projector is switched off, so the events of that time are
   * never projected when it is switched on again: turning it on always starts from now, as on the
   * first start. A backfill of the gap is its own, deliberate command.
   */
  moveToLatestEvent(projectorName: string): Promise<void>;
}

const NEWEST_EVENT = sql`(select coalesce(max(${domainEvent.id}), 0) from ${domainEvent})`;

export class DrizzleProjectorCursorStart implements IProjectorCursorStart {
  constructor(private readonly db: Database) {}

  async startAtLatestEvent(projectorName: string): Promise<void> {
    await this.db
      .insert(projectorState)
      .values({ projectorName, lastProcessedEventId: NEWEST_EVENT })
      .onConflictDoNothing();
  }

  async moveToLatestEvent(projectorName: string): Promise<void> {
    await this.db
      .insert(projectorState)
      .values({ projectorName, lastProcessedEventId: NEWEST_EVENT })
      .onConflictDoUpdate({
        target: projectorState.projectorName,
        set: {
          lastProcessedEventId: sql`greatest(${projectorState.lastProcessedEventId}, excluded.last_processed_event_id)`,
          updatedAt: sql`now()`,
        },
      });
  }
}
