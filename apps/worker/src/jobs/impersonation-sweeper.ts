import type { createDb } from "@auction/db";
import { domainEvent, impersonationSession } from "@auction/db/schema";
import { and, eq, isNull, lt } from "drizzle-orm";
import type pino from "pino";

type Db = ReturnType<typeof createDb>;

const ADMIN_IMPERSONATION_AGGREGATE_TYPE = "admin_impersonation";

/** close impersonation sessions that never received an explicit `ended`
 * event (browser closed, worker crash, etc.).
 */
export async function runImpersonationSweeperJob(input: { db: Db; log: pino.Logger }): Promise<void> {
  const { db, log } = input;
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);

  const candidates = await db
    .select({
      id: impersonationSession.id,
      actorUserId: impersonationSession.actorUserId,
      targetLegalEntityId: impersonationSession.targetLegalEntityId,
    })
    .from(impersonationSession)
    .where(
      and(
        isNull(impersonationSession.endedAt),
        lt(impersonationSession.expiresAt, cutoff),
      ),
    )
    .limit(500);

  let inserted = 0;
  for (const row of candidates) {
    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(impersonationSession)
        .set({ endedAt: new Date(), endReason: "timeout_swept" })
        .where(and(eq(impersonationSession.id, row.id), isNull(impersonationSession.endedAt)))
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

  if (inserted > 0) {
    log.info({ inserted }, "impersonation_sweeper_inserted_timeout_ends");
  }
}
