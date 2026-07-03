import { sourceOfFunds } from "@auction/db";
import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../lib/projector.types.js";

export type DocumentsRequestedPayload = {
  sourceOfFundsId?: string;
  userId?: string;
  documentTypes?: string[];
  note?: string | null;
};

export type DocumentsSubmittedPayload = {
  sourceOfFundsId?: string;
  userId?: string;
  documentCount?: number;
};

export type ReviewedPayload = {
  sourceOfFundsId?: string;
  userId?: string;
  status?: string;
};

export async function loadSettlementContext(
  db: Db,
  userId: string,
): Promise<{ summary: string | null }> {
  const [row] = await db
    .select({ exposureAmount: sourceOfFunds.exposureAmount, currency: sourceOfFunds.currency })
    .from(sourceOfFunds)
    .where(and(eq(sourceOfFunds.userId, userId), eq(sourceOfFunds.status, "pending")))
    .orderBy(sql`${sourceOfFunds.createdAt} DESC`)
    .limit(1);
  if (!row) return { summary: null };
  return { summary: `${row.currency} ${row.exposureAmount} exposure under review` };
}
