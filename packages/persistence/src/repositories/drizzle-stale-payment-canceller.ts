import type { Database } from "@auction/db";
import { payment, paymentCheckoutSession, paymentGroup } from "@auction/db/schema";
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
import type {
  IStalePaymentCanceller,
  OpenGroupCheckout,
} from "../interfaces/stale-payment-canceller.js";

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

  async listOpenGroupsWithCheckout(limit: number): Promise<OpenGroupCheckout[]> {
    const groups = await this.db
      .select({
        id: paymentGroup.id,
        payerUserId: paymentGroup.createdByUserId,
        buyerLegalEntityId: paymentGroup.buyerLegalEntityId,
        stripeCheckoutSessionId: paymentGroup.stripeCheckoutSessionId,
        stripePaymentIntentId: paymentGroup.stripePaymentIntentId,
      })
      .from(paymentGroup)
      .where(
        and(
          eq(paymentGroup.status, "open"),
          or(
            isNotNull(paymentGroup.stripeCheckoutSessionId),
            isNotNull(paymentGroup.stripePaymentIntentId),
          ),
        ),
      )
      .orderBy(asc(paymentGroup.createdAt))
      .limit(limit);
    if (groups.length === 0) return [];
    const members = await this.db
      .select({
        groupId: payment.paymentGroupId,
        paymentId: payment.id,
        payerUserId: payment.buyerId,
        buyerLegalEntityId: payment.buyerLegalEntityId,
      })
      .from(payment)
      .where(
        and(
          inArray(
            payment.paymentGroupId,
            groups.map((g) => g.id),
          ),
          inArray(payment.status, ["pending", "authorized"]),
        ),
      )
      .orderBy(asc(payment.createdAt));
    return groups.map((group) => ({
      ...group,
      members: members
        .filter((m) => m.groupId === group.id)
        .map(({ paymentId, payerUserId, buyerLegalEntityId }) => ({
          paymentId,
          payerUserId,
          buyerLegalEntityId,
        })),
    }));
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
