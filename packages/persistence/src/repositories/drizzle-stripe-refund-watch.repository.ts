import type { Database } from "@auction/db";
import { stripeRefundWatch } from "@auction/db/schema";
import { eq, sql } from "drizzle-orm";
import type {
  IStripeRefundWatchRepository,
  StripeRefundSighting,
  StripeRefundWatchRow,
} from "../interfaces/stripe-refund-watch.repository.js";

const NOT_FINAL = new Set(["pending", "requires_action"]);

type ClaimedRow = {
  stripe_refund_id: string;
  stripe_charge_id: string;
  status: string;
  amount_pence: number;
  payment_id: string | null;
  staff_refund: Record<string, unknown> | null;
  attempts: number;
};

function rowsOf(result: unknown): ClaimedRow[] {
  if (Array.isArray(result)) return result as ClaimedRow[];
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows?: ClaimedRow[] }).rows ?? [];
  }
  return [];
}

export class DrizzleStripeRefundWatchRepository implements IStripeRefundWatchRepository {
  constructor(private readonly db: Database) {}

  async watch(refunds: readonly StripeRefundSighting[]): Promise<void> {
    const open = refunds.filter((r) => NOT_FINAL.has(r.status));
    if (open.length === 0) return;
    await this.db
      .insert(stripeRefundWatch)
      .values(
        open.map((r) => ({
          stripeRefundId: r.stripeRefundId,
          stripeChargeId: r.stripeChargeId,
          status: r.status,
          amountPence: Math.max(0, Math.trunc(r.amountPence)),
          paymentId: r.paymentId,
          staffRefund: r.staffRefund ?? null,
        })),
      )
      .onConflictDoUpdate({
        target: stripeRefundWatch.stripeRefundId,
        set: {
          staffRefund: sql`coalesce(${stripeRefundWatch.staffRefund}, excluded."staff_refund")`,
        },
      });
  }

  async claimDue(
    limit: number,
    leaseMs: number,
    now = new Date(),
  ): Promise<StripeRefundWatchRow[]> {
    const leaseUntil = new Date(now.getTime() + leaseMs);
    // The batch is chosen once, in a CTE, so the update can never take more than `limit` rows.
    const result = await this.db.execute(sql`
      WITH due AS (
        SELECT "stripe_refund_id" FROM ${stripeRefundWatch}
        WHERE "settled_at" IS NULL AND "next_check_at" <= ${now}
        ORDER BY "next_check_at", "stripe_refund_id"
        LIMIT ${Math.max(1, Math.trunc(limit))}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE ${stripeRefundWatch} AS w
      SET "next_check_at" = ${leaseUntil}, "updated_at" = ${now}
      FROM due
      WHERE w."stripe_refund_id" = due."stripe_refund_id"
      RETURNING w."stripe_refund_id", w."stripe_charge_id", w."status", w."amount_pence",
        w."payment_id", w."staff_refund", w."attempts"
    `);
    return rowsOf(result)
      .map((r) => ({
        stripeRefundId: r.stripe_refund_id,
        stripeChargeId: r.stripe_charge_id,
        status: r.status,
        amountPence: Number(r.amount_pence),
        paymentId: r.payment_id,
        staffRefund: r.staff_refund ?? null,
        attempts: Number(r.attempts),
      }))
      .sort((a, b) => a.stripeRefundId.localeCompare(b.stripeRefundId));
  }

  async reschedule(
    stripeRefundId: string,
    update: { status: string; nextCheckAt: Date; lastError: string | null },
  ): Promise<void> {
    await this.db
      .update(stripeRefundWatch)
      .set({
        status: update.status,
        nextCheckAt: update.nextCheckAt,
        lastError: update.lastError,
        attempts: sql`${stripeRefundWatch.attempts} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(stripeRefundWatch.stripeRefundId, stripeRefundId));
  }

  async markSettled(stripeRefundId: string, status: string, now = new Date()): Promise<void> {
    await this.db
      .update(stripeRefundWatch)
      .set({ status, settledAt: now, lastError: null, updatedAt: now })
      .where(eq(stripeRefundWatch.stripeRefundId, stripeRefundId));
  }
}
