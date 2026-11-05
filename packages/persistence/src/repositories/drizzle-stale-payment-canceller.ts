import type { Database } from "@auction/db";
import { payment, paymentCheckoutSession } from "@auction/db/schema";
import { and, eq, gte, inArray, isNull, notExists } from "drizzle-orm";
import type { IStalePaymentCanceller } from "../interfaces/stale-payment-canceller.js";

export class DrizzleStalePaymentCanceller implements IStalePaymentCanceller {
  constructor(private readonly db: Database) {}

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
