import { shopFulfilment } from "@auction/db/schema";
import { type ShopFulfilmentStatus, fulfilmentStageColumn } from "@auction/shop-domain";
import { type SQL, sql } from "drizzle-orm";

/**
 * The stage date to record with a move to `status`, for the buyer's order timeline. A stage keeps
 * the first date it was reached, so moving back and forward again never rewrites it.
 */
export function fulfilmentStageStamp(
  status: ShopFulfilmentStatus,
  at: Date,
): Partial<Record<NonNullable<ReturnType<typeof fulfilmentStageColumn>>, SQL>> {
  const column = fulfilmentStageColumn(status);
  if (!column) return {};
  return { [column]: sql`coalesce(${shopFulfilment[column]}, ${at.toISOString()}::timestamptz)` };
}
