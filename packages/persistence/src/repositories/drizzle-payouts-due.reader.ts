import type { Database } from "@auction/db";
import { payout } from "@auction/db/schema";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import type { IPayoutsDueReader, PayoutsDueRow } from "../interfaces/index.js";

/** Payouts that are settled but not yet in the organisation's bank account. */
const DUE_STATUSES = ["scheduled", "in_transit"];

/** The organisation's payouts still to arrive, with net totals per currency. */
export class DrizzlePayoutsDueReader implements IPayoutsDueReader {
  constructor(private readonly db: Database) {}

  async listDue(legalEntityId: string, now: Date): Promise<PayoutsDueRow[]> {
    const rows = await this.db
      .select({
        currency: payout.currency,
        count: count(),
        amount: sql<string>`coalesce(sum(${payout.netAmount}), 0)`,
        nextDate: sql<Date | null>`min(${payout.periodEnd}) filter (where ${payout.periodEnd} >= ${now})`,
        overdueSince: sql<Date | null>`min(${payout.periodEnd}) filter (where ${payout.periodEnd} < ${now})`,
      })
      .from(payout)
      .where(and(eq(payout.legalEntityId, legalEntityId), inArray(payout.status, DUE_STATUSES)))
      .groupBy(payout.currency);
    return rows.map((row) => ({
      currency: row.currency,
      count: Number(row.count),
      amount: String(row.amount),
      nextDate: row.nextDate ? new Date(row.nextDate) : null,
      overdueSince: row.overdueSince ? new Date(row.overdueSince) : null,
    }));
  }
}
