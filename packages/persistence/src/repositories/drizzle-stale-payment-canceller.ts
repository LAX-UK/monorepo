import type { Database } from "@auction/db";
import { payment, paymentCheckoutSession } from "@auction/db/schema";
import {
  and,
  asc,
  eq,
  exists,
  gte,
  inArray,
  isNotNull,
  isNull,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import type { IStalePaymentCanceller } from "../interfaces/stale-payment-canceller.js";

export class DrizzleStalePaymentCanceller implements IStalePaymentCanceller {
  constructor(private readonly db: Database) {}

  async now(): Promise<Date> {
    const result = await this.db.execute(sql`select now() as now`);
    const row = (result.rows as { now: string | Date }[])[0];
    return new Date(row?.now ?? Date.now());
  }

  async listUnpaidWithCheckout(
    limit: number,
  ): Promise<{ id: string; payerUserId: string; buyerLegalEntityId: string }[]> {
    const rows = await this.db
      .select({
        id: payment.id,
        payerUserId: payment.buyerId,
        buyerLegalEntityId: payment.buyerLegalEntityId,
      })
      .from(payment)
      .where(
        and(
          inArray(payment.status, ["pending", "authorized"]),
          isNull(payment.paymentGroupId),
          or(
            isNotNull(payment.stripePaymentIntentId),
            exists(
              this.db
                .select({ id: paymentCheckoutSession.stripeSessionId })
                .from(paymentCheckoutSession)
                .where(eq(paymentCheckoutSession.paymentId, payment.id)),
            ),
          ),
        ),
      )
      .orderBy(asc(payment.createdAt))
      .limit(limit);
    return rows;
  }

  async cancelIfUntouchedSince(paymentId: string, since: Date): Promise<boolean> {
    // One statement, so nothing can change between the check and the cancel.
    const rows = await this.db
      .update(payment)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(payment.id, paymentId),
          inArray(payment.status, ["pending", "authorized"]),
          isNull(payment.paymentGroupId),
          notExists(
            this.db
              .select({ id: paymentCheckoutSession.stripeSessionId })
              .from(paymentCheckoutSession)
              .where(
                and(
                  eq(paymentCheckoutSession.paymentId, payment.id),
                  gte(paymentCheckoutSession.createdAt, since),
                ),
              ),
          ),
        ),
      )
      .returning({ id: payment.id });
    return rows.length > 0;
  }
}
