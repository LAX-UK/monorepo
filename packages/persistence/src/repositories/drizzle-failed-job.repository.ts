import type { Database } from "@auction/db";
import { failedJobs } from "@auction/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import type {
  FailedJobReplayRow,
  IFailedJobRepository,
} from "../interfaces/failed-job.repository.js";

export class DrizzleFailedJobRepository implements IFailedJobRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<FailedJobReplayRow | null> {
    const [row] = await this.db.select().from(failedJobs).where(eq(failedJobs.id, id)).limit(1);
    if (!row) return null;
    return {
      id: row.id,
      originalQueue: row.originalQueue,
      originalJobName: row.originalJobName ?? null,
      payloadJson: row.payloadJson ?? null,
      replayedAt: row.replayedAt ?? null,
    };
  }

  async claimReplay(id: string, replayedBy: string): Promise<FailedJobReplayRow | null> {
    const [claimed] = await this.db
      .update(failedJobs)
      .set({ replayedAt: new Date(), replayedBy })
      .where(and(eq(failedJobs.id, id), isNull(failedJobs.replayedAt)))
      .returning();
    if (!claimed) return null;
    return {
      id: claimed.id,
      originalQueue: claimed.originalQueue,
      originalJobName: claimed.originalJobName ?? null,
      payloadJson: claimed.payloadJson ?? null,
      replayedAt: claimed.replayedAt ?? null,
    };
  }

  async clearReplayClaim(id: string): Promise<void> {
    await this.db
      .update(failedJobs)
      .set({ replayedAt: null, replayedBy: null })
      .where(eq(failedJobs.id, id));
  }
}
