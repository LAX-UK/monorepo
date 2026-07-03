import type { Database } from "@auction/db";
import { payout } from "@auction/db/schema";
import type { Payout, PayoutStatus } from "@auction/types";
import { and, desc, eq, sql } from "drizzle-orm";
import type { IPayoutRepository, ListPayoutsFilter } from "../ports/payout-repository.js";

type PayoutRow = typeof payout.$inferSelect;

function rowToPayout(row: PayoutRow): Payout {
  return {
    id: row.id,
    legalEntityId: row.legalEntityId,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    grossAmount: String(row.grossAmount),
    platformFee: String(row.platformFee),
    stripeFee: String(row.stripeFee),
    netAmount: String(row.netAmount),
    currency: row.currency,
    status: row.status as PayoutStatus,
    stripeTransferId: row.stripeTransferId ?? null,
    xeroBillId: row.xeroBillId ?? null,
    failureReason: row.failureReason ?? null,
    processedAt: row.processedAt ?? null,
    statementUrl: row.statementUrl ?? null,
    statementGenerationError: row.statementGenerationError ?? null,
    createdAt: row.createdAt,
  };
}

export class DrizzleExportPayoutReader
  implements Pick<IPayoutRepository, "list" | "countMatching">
{
  constructor(private readonly db: Database) {}

  async list(filter: ListPayoutsFilter): Promise<Payout[]> {
    const conditions = [
      filter.legalEntityId ? eq(payout.legalEntityId, filter.legalEntityId) : undefined,
      filter.status ? eq(payout.status, filter.status) : undefined,
    ].filter((c): c is NonNullable<typeof c> => c !== undefined);
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;

    const rows = await (where
      ? this.db
          .select()
          .from(payout)
          .where(where)
          .orderBy(desc(payout.periodEnd))
          .limit(limit)
          .offset(offset)
      : this.db.select().from(payout).orderBy(desc(payout.periodEnd)).limit(limit).offset(offset));
    return rows.map(rowToPayout);
  }

  async countMatching(filter: Omit<ListPayoutsFilter, "limit" | "offset">): Promise<number> {
    const conditions = [
      filter.legalEntityId ? eq(payout.legalEntityId, filter.legalEntityId) : undefined,
      filter.status ? eq(payout.status, filter.status) : undefined,
    ].filter((c): c is NonNullable<typeof c> => c !== undefined);
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [row] = await (where
      ? this.db.select({ n: sql<number>`count(*)::int` }).from(payout).where(where)
      : this.db.select({ n: sql<number>`count(*)::int` }).from(payout));
    return row?.n ?? 0;
  }
}
