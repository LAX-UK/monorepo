import type { Database } from "@auction/db";
import { payment, paymentGroup } from "@auction/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import type { BidPaymentGroupFact } from "../interfaces/bid-portfolio.reader.js";
import type { IPaymentGroupFactsReader } from "../interfaces/payment-group-facts.reader.js";
import { loadGroupMembers } from "./payment-group-members.js";

export class DrizzlePaymentGroupFactsReader implements IPaymentGroupFactsReader {
  constructor(private readonly db: Database) {}

  async processingForPayments(
    paymentIds: readonly string[],
  ): Promise<Map<string, BidPaymentGroupFact>> {
    if (paymentIds.length === 0) return new Map();
    const rows = await this.db
      .select({
        paymentId: payment.id,
        id: paymentGroup.id,
        status: paymentGroup.status,
        checkoutRail: paymentGroup.checkoutRail,
        totalAmount: paymentGroup.totalAmount,
        amountReceived: paymentGroup.amountReceived,
      })
      .from(payment)
      .innerJoin(paymentGroup, eq(paymentGroup.id, payment.paymentGroupId))
      .where(and(inArray(payment.id, [...paymentIds]), eq(paymentGroup.status, "processing")));
    const members = await loadGroupMembers(
      this.db,
      rows.map((row) => row.id),
    );
    return new Map(
      rows.map(
        ({ paymentId, ...group }) =>
          [paymentId, { ...group, members: members.get(group.id) ?? [] }] satisfies [
            string,
            BidPaymentGroupFact,
          ],
      ),
    );
  }
}
