import type { Database } from "@auction/db";
import { paymentGroupDeliveryRefund } from "@auction/db/schema";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type {
  DeliveryRefundRequest,
  DeliveryRefundRequestOutcome,
  DeliveryRefundRequestStatus,
  IPaymentGroupDeliveryRefundRepository,
  NewDeliveryRefundRequest,
} from "../interfaces/payment-group-delivery-refund.repository.js";

type Row = typeof paymentGroupDeliveryRefund.$inferSelect;

const STATUSES: ReadonlySet<string> = new Set<DeliveryRefundRequestStatus>([
  "pending",
  "succeeded",
  "failed",
]);

function mapRow(row: Row): DeliveryRefundRequest {
  if (!STATUSES.has(row.status)) {
    throw new Error(`payment_group_delivery_refund ${row.id} has unknown status ${row.status}`);
  }
  return {
    id: row.id,
    paymentGroupId: row.paymentGroupId,
    deliveryQuoteId: row.deliveryQuoteId,
    amountPence: row.amountPence,
    status: row.status as DeliveryRefundRequestStatus,
    staffReason: row.staffReason,
    actorUserId: row.actorUserId,
    stripeRefundId: row.stripeRefundId,
    stripeStatus: row.stripeStatus,
    createdAt: row.createdAt,
  };
}

export class DrizzlePaymentGroupDeliveryRefundRepository
  implements IPaymentGroupDeliveryRefundRepository
{
  async listForQuoteInTransaction(
    tx: Database,
    paymentGroupId: string,
    deliveryQuoteId: string,
  ): Promise<DeliveryRefundRequest[]> {
    const rows = await tx
      .select()
      .from(paymentGroupDeliveryRefund)
      .where(
        and(
          eq(paymentGroupDeliveryRefund.paymentGroupId, paymentGroupId),
          eq(paymentGroupDeliveryRefund.deliveryQuoteId, deliveryQuoteId),
        ),
      )
      .orderBy(asc(paymentGroupDeliveryRefund.createdAt), asc(paymentGroupDeliveryRefund.id));
    return rows.map(mapRow);
  }

  async insertInTransaction(
    tx: Database,
    input: NewDeliveryRefundRequest,
  ): Promise<DeliveryRefundRequest> {
    const [row] = await tx
      .insert(paymentGroupDeliveryRefund)
      .values({
        paymentGroupId: input.paymentGroupId,
        deliveryQuoteId: input.deliveryQuoteId,
        amountPence: input.amountPence,
        staffReason: input.staffReason,
        actorUserId: input.actorUserId,
        status: "pending",
      })
      .returning();
    if (!row) throw new Error("payment_group_delivery_refund insert returned no row");
    return mapRow(row);
  }

  async recordOutcome(
    conn: Database,
    id: string,
    outcome: DeliveryRefundRequestOutcome,
  ): Promise<boolean> {
    const rows = await conn
      .update(paymentGroupDeliveryRefund)
      .set({
        status: outcome.status,
        stripeRefundId: outcome.stripeRefundId,
        stripeStatus: outcome.stripeStatus,
        updatedAt: sql`now()`,
      })
      .where(eq(paymentGroupDeliveryRefund.id, id))
      .returning({ id: paymentGroupDeliveryRefund.id });
    return rows.length > 0;
  }

  async releaseUnsentInTransaction(tx: Database, id: string): Promise<boolean> {
    const rows = await tx
      .update(paymentGroupDeliveryRefund)
      .set({ status: "failed", updatedAt: sql`now()` })
      .where(
        and(
          eq(paymentGroupDeliveryRefund.id, id),
          eq(paymentGroupDeliveryRefund.status, "pending"),
          isNull(paymentGroupDeliveryRefund.stripeRefundId),
        ),
      )
      .returning({ id: paymentGroupDeliveryRefund.id });
    return rows.length > 0;
  }
}
