import type { Database } from "@auction/db";
import { legalEntity, payment, paymentGroup } from "@auction/db/schema";
import { and, asc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import type {
  IPartFundedTransfersReader,
  PartFundedTransfer,
} from "../../interfaces/accounting.js";

/** numeric(18,2) pounds to whole pence in the database: exact, no floating point. */
const totalPence = sql<string>`(${payment.amount} * 100)::bigint`;
const groupTotalPence = sql<string>`(${paymentGroup.totalAmount} * 100)::bigint`;
const groupReceivedPence = sql<string>`(${paymentGroup.amountReceived} * 100)::bigint`;
const accountName = sql<string>`coalesce(nullif(trim(${legalEntity.legalName}), ''), ${legalEntity.displayName})`;

/**
 * Bank transfers that have partly arrived: an invoice's own transfer, or a "Pay several" group's.
 * Read only, from the stored rows (what the provider reported as received, never worked out). They
 * make no Books document; the payment is booked once the whole amount has arrived.
 */
export class DrizzlePartFundedTransfersReader implements IPartFundedTransfersReader {
  constructor(private readonly db: Database) {}

  async list(limit: number): Promise<readonly PartFundedTransfer[]> {
    const payments = await this.db
      .select({
        id: payment.id,
        buyer: accountName,
        receivedPence: payment.transferReceivedPence,
        totalPence,
        createdAt: payment.createdAt,
      })
      .from(payment)
      .innerJoin(legalEntity, eq(legalEntity.id, payment.buyerLegalEntityId))
      .where(
        and(
          isNull(payment.paymentGroupId),
          inArray(payment.status, ["pending", "authorized"]),
          gt(payment.transferReceivedPence, 0),
          sql`${payment.transferReceivedPence} < ${totalPence}`,
        ),
      )
      .orderBy(asc(payment.createdAt), asc(payment.id))
      .limit(limit);
    const groups = await this.db
      .select({
        id: paymentGroup.id,
        buyer: accountName,
        receivedPence: groupReceivedPence,
        totalPence: groupTotalPence,
        since: paymentGroup.receivedEventAt,
        createdAt: paymentGroup.createdAt,
      })
      .from(paymentGroup)
      .innerJoin(legalEntity, eq(legalEntity.id, paymentGroup.buyerLegalEntityId))
      .where(
        and(
          eq(paymentGroup.status, "processing"),
          sql`${paymentGroup.amountReceived} > 0`,
          sql`${paymentGroup.amountReceived} < ${paymentGroup.totalAmount}`,
        ),
      )
      .orderBy(asc(paymentGroup.createdAt), asc(paymentGroup.id))
      .limit(limit);
    const rows: (PartFundedTransfer & { readonly order: number })[] = [
      ...payments.map((p) => ({
        source: "payment" as const,
        id: p.id.toLowerCase(),
        buyer: p.buyer,
        receivedPence: p.receivedPence,
        totalPence: Number(p.totalPence),
        since: null,
        order: p.createdAt.getTime(),
      })),
      ...groups.map((g) => ({
        source: "payment_group" as const,
        id: g.id.toLowerCase(),
        buyer: g.buyer,
        receivedPence: Number(g.receivedPence),
        totalPence: Number(g.totalPence),
        since: g.since,
        order: g.createdAt.getTime(),
      })),
    ];
    return rows
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
      .slice(0, limit)
      .map(({ order: _order, ...row }) => row);
  }
}
