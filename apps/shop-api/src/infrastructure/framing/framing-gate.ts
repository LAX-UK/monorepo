import type { Database } from "@auction/db";
import { shopFramingTask, shopOrderLine } from "@auction/db/schema";
import { type FramingTaskStatus, framingTaskFinished } from "@auction/shop-domain";
import { and, eq } from "drizzle-orm";

/*
 * Where frames hold an order back. Framing is a step of production between picking and quality
 * check: a print does not pass quality check, and its order does not become ready to dispatch,
 * while a frame sold with it is still to be made. A frame that was refunded has a cancelled task,
 * so it never holds anything back.
 */

/** Whether the frame sold with this print still has work to do. */
export async function printHasOpenFrame(db: Database, printLineId: string): Promise<boolean> {
  const rows = await db
    .select({ status: shopFramingTask.status })
    .from(shopFramingTask)
    .innerJoin(shopOrderLine, eq(shopFramingTask.orderLineId, shopOrderLine.id))
    .where(eq(shopOrderLine.framingForLineId, printLineId));
  return rows.some((row) => !framingTaskFinished(row.status as FramingTaskStatus));
}

/** Whether any frame on the order still has work to do. */
export async function orderHasOpenFrame(db: Database, orderId: string): Promise<boolean> {
  const rows = await db
    .select({ status: shopFramingTask.status })
    .from(shopFramingTask)
    .innerJoin(shopOrderLine, eq(shopFramingTask.orderLineId, shopOrderLine.id))
    .where(and(eq(shopOrderLine.orderId, orderId), eq(shopOrderLine.kind, "framing")));
  return rows.some((row) => !framingTaskFinished(row.status as FramingTaskStatus));
}
