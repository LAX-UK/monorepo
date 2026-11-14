import type { Database } from "@auction/db";
import { legalEntity, paymentGroup } from "@auction/db/schema";
import { asc, eq, gt, sql } from "drizzle-orm";
import type {
  IUnattributedRefundsReader,
  UnattributedRefund,
} from "../../interfaces/accounting.js";

const accountName = sql<string>`coalesce(nullif(trim(${legalEntity.legalName}), ''), ${legalEntity.displayName})`;

/**
 * "Pay several" groups holding refunds that no invoice or courier quote could take
 * (`payment_group.refund_unattributed_pence`, raised by the refund webhooks). Read only. They make
 * no Books document: once a person assigns one, the invoice's or quote's own refund record moves
 * and its credit note follows (flows 8 and 9).
 */
export class DrizzleUnattributedRefundsReader implements IUnattributedRefundsReader {
  constructor(private readonly db: Database) {}

  async list(limit: number): Promise<readonly UnattributedRefund[]> {
    if (limit <= 0) return [];
    const rows = await this.db
      .select({
        id: paymentGroup.id,
        amountPence: paymentGroup.refundUnattributedPence,
        buyer: accountName,
        settledAt: paymentGroup.settledAt,
      })
      .from(paymentGroup)
      .innerJoin(legalEntity, eq(legalEntity.id, paymentGroup.buyerLegalEntityId))
      .where(gt(paymentGroup.refundUnattributedPence, 0))
      .orderBy(asc(paymentGroup.createdAt), asc(paymentGroup.id))
      .limit(limit);
    return rows.map((r) => ({
      paymentGroupId: r.id.toLowerCase(),
      amountPence: r.amountPence,
      buyer: r.buyer,
      settledAt: r.settledAt,
    }));
  }
}
