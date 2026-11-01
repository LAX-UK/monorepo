import type { Database } from "@auction/db";
import { payment, payout, payoutLine } from "@auction/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import type { DuePayoutRow, IPayoutsDueReader } from "../interfaces/index.js";

/** Payouts that are settled but not yet in the organisation's bank account. */
const DUE_STATUSES = ["scheduled", "in_transit"];

/** The organisation's payouts still to arrive, each with the lines its amount is built from. */
export class DrizzlePayoutsDueReader implements IPayoutsDueReader {
  constructor(private readonly db: Database) {}

  async listDue(legalEntityId: string): Promise<DuePayoutRow[]> {
    const payouts = await this.db
      .select({
        id: payout.id,
        currency: payout.currency,
        periodEnd: payout.periodEnd,
        stripeFee: payout.stripeFee,
      })
      .from(payout)
      .where(and(eq(payout.legalEntityId, legalEntityId), inArray(payout.status, DUE_STATUSES)));
    if (payouts.length === 0) return [];
    const lines = await this.db
      .select({
        payoutId: payoutLine.payoutId,
        kind: payoutLine.kind,
        amount: payoutLine.amount,
        paymentAmount: payment.amount,
        platformFee: payment.platformFee,
      })
      .from(payoutLine)
      .leftJoin(payment, eq(payment.id, payoutLine.paymentId))
      .where(
        inArray(
          payoutLine.payoutId,
          payouts.map((row) => row.id),
        ),
      );
    return payouts.map((row) => ({
      currency: row.currency,
      periodEnd: new Date(row.periodEnd),
      stripeFee: String(row.stripeFee),
      lines: lines
        .filter((line) => line.payoutId === row.id)
        .map((line) => ({
          kind: line.kind,
          amount: String(line.amount),
          payment:
            line.paymentAmount != null && line.platformFee != null
              ? { amount: String(line.paymentAmount), platformFee: String(line.platformFee) }
              : null,
        })),
    }));
  }
}
