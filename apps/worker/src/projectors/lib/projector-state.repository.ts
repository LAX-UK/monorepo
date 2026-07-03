import { projectorState } from "@auction/db";
import { eq, sql } from "drizzle-orm";
import type { Db, ProjectorDbConnection } from "./projector.types.js";

export class ProjectorStateRepository {
  constructor(private readonly db: Db) {}

  async ensureCursor(projectorName: string, conn: ProjectorDbConnection = this.db): Promise<void> {
    await conn
      .insert(projectorState)
      .values({ projectorName, lastProcessedEventId: 0 })
      .onConflictDoNothing();
  }

  async getCursor(projectorName: string, conn: ProjectorDbConnection = this.db): Promise<number> {
    const [cursorRow] = await conn
      .select({ last: projectorState.lastProcessedEventId })
      .from(projectorState)
      .where(eq(projectorState.projectorName, projectorName))
      .limit(1);
    return cursorRow?.last ?? 0;
  }

  async advanceCursor(
    projectorName: string,
    maxId: number,
    conn: ProjectorDbConnection = this.db,
  ): Promise<void> {
    if (maxId <= 0) return;
    await conn
      .update(projectorState)
      .set({ lastProcessedEventId: maxId, updatedAt: new Date(), lastError: null })
      .where(eq(projectorState.projectorName, projectorName));
  }

  /** Same as advanceCursor but binds projector name via sql fragment (legacy zoho path). */
  async advanceCursorLiteralName(
    projectorName: string,
    maxId: number,
    conn: ProjectorDbConnection = this.db,
  ): Promise<void> {
    if (maxId <= 0) return;
    await conn
      .update(projectorState)
      .set({ lastProcessedEventId: maxId, updatedAt: new Date(), lastError: null })
      .where(sql`${projectorState.projectorName} = ${projectorName}`);
  }
}
