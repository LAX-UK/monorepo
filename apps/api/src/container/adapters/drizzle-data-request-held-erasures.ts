import type { Database } from "@auction/db";
import { dataRequestErasureHold } from "@auction/db/schema";
import { asc, eq } from "drizzle-orm";
import type {
  HeldErasureFlag,
  HeldErasurePlan,
  HeldErasureReason,
  IHeldErasureLog,
} from "../../services/admin/data-requests/data-request-held-erasures.js";

/** `data_request_erasure_hold`, one row per request whose erasure a deal held. */
export class DrizzleHeldErasures implements IHeldErasureLog {
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
}
