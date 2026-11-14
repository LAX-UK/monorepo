import type { Database } from "@auction/db";
import { dataRequestErasureHold } from "@auction/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import type {
  DueHeldErasure,
  HeldErasureFlag,
  HeldErasurePlan,
  HeldErasureReason,
  IHeldErasureLog,
  IHeldErasureRecheckQueue,
} from "../../services/admin/data-requests/data-request-held-erasures.js";

/** `data_request_erasure_hold`, one row per request whose erasure a deal held. */
export class DrizzleHeldErasures implements IHeldErasureLog, IHeldErasureRecheckQueue {
  constructor(private readonly db: Database) {}

  async held(input: {
    reference: string;
    requestedByUserId: string;
    plan: HeldErasurePlan;
  }): Promise<void> {
    const row = {
      requestedByUserId: input.requestedByUserId,
      state: input.plan.state,
      reason: input.plan.reason,
      heldUntil: input.plan.heldUntil,
      recheckAt: input.plan.recheckAt,
      claimedUntil: null,
      updatedAt: new Date(),
    };
    await this.db
      .insert(dataRequestErasureHold)
      .values({ reference: input.reference, ...row })
      .onConflictDoUpdate({ target: dataRequestErasureHold.reference, set: row });
  }

  async cleared(reference: string): Promise<void> {
    await this.db
      .delete(dataRequestErasureHold)
      .where(eq(dataRequestErasureHold.reference, reference));
  }

  async needingStaff(): Promise<HeldErasureFlag[]> {
    const rows = await this.db
      .select({
        reference: dataRequestErasureHold.reference,
        reason: dataRequestErasureHold.reason,
        heldUntil: dataRequestErasureHold.heldUntil,
      })
      .from(dataRequestErasureHold)
      .where(eq(dataRequestErasureHold.state, "needs_staff"))
      .orderBy(asc(dataRequestErasureHold.updatedAt));
    return rows.map((row) => ({
      reference: row.reference,
      reason: row.reason as HeldErasureReason,
      heldUntil: row.heldUntil?.toISOString() ?? null,
    }));
  }

  async claimDue(now: Date, limit: number, leaseMs: number): Promise<DueHeldErasure[]> {
    const until = new Date(now.getTime() + leaseMs);
    const result = await this.db.execute<{
      reference: string;
      requested_by_user_id: string | null;
      reason: string;
      held_until: Date | string | null;
    }>(sql`
      UPDATE "data_request_erasure_hold" AS hold
      SET "claimed_until" = ${until}, "updated_at" = ${now}
      WHERE hold."reference" IN (
        SELECT "reference" FROM "data_request_erasure_hold"
        WHERE "state" = 'waiting' AND "recheck_at" <= ${now}
          AND ("claimed_until" IS NULL OR "claimed_until" <= ${now})
        ORDER BY "recheck_at", "reference"
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING hold."reference", hold."requested_by_user_id", hold."reason", hold."held_until"
    `);
    return result.rows.map((row) => ({
      reference: row.reference,
      requestedByUserId: row.requested_by_user_id,
      reason: row.reason as HeldErasureReason,
      heldUntil: row.held_until === null ? null : new Date(row.held_until),
    }));
  }

  async needsStaff(reference: string, reason: "still_held" | "cannot_run"): Promise<void> {
    await this.db
      .update(dataRequestErasureHold)
      .set({
        state: "needs_staff",
        reason,
        recheckAt: null,
        claimedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(dataRequestErasureHold.reference, reference));
  }
}
