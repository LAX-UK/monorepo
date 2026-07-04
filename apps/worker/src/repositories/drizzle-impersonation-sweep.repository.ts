import type { Database } from "@auction/db";
import { domainEvent, impersonationSession } from "@auction/db/schema";
import { ADMIN_IMPERSONATION_AGGREGATE_TYPE } from "@auction/persistence/lib";
import { and, eq, isNull, lt } from "drizzle-orm";
import type { IImpersonationSweepRepository } from "../interfaces/impersonation-sweep.repository.js";

export class DrizzleImpersonationSweepRepository implements IImpersonationSweepRepository {
  constructor(private readonly db: Database) {}

  async sweepStaleSessions(cutoff: Date, batchLimit: number): Promise<number> {
    const candidates = await this.db
      .select({
        id: impersonationSession.id,
        actorUserId: impersonationSession.actorUserId,
        targetLegalEntityId: impersonationSession.targetLegalEntityId,
      })
      .from(impersonationSession)
      .where(
        and(isNull(impersonationSession.endedAt), lt(impersonationSession.expiresAt, cutoff)),
      )
      .limit(batchLimit);

    let inserted = 0;
    for (const row of candidates) {
      await this.db.transaction(async (tx) => {
        const [updated] = await tx
          .update(impersonationSession)
          .set({ endedAt: new Date(), endReason: "timeout_swept" })
          .where(
            and(eq(impersonationSession.id, row.id), isNull(impersonationSession.endedAt)),
          )
          .returning({ id: impersonationSession.id });
        if (!updated) return;

        await tx.insert(domainEvent).values({
          aggregateType: ADMIN_IMPERSONATION_AGGREGATE_TYPE,
          aggregateId: row.id,
          eventType: "admin.impersonation_ended",
          payload: {
            session_id: row.id,
            end_reason: "timeout_swept",
          },
          producer: "apps/worker",
          actorUserId: row.actorUserId,
          actingLegalEntityId: row.targetLegalEntityId,
          schemaVersion: 1,
        });
        inserted += 1;
      });
    }
    return inserted;
  }
}
