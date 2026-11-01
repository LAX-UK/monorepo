import type { Database } from "@auction/db";
import {
  bidIdentityDirectory,
  legalEntity,
  lot,
  payment,
  payout,
  payoutLine,
} from "@auction/db/schema";
import { eq, inArray } from "drizzle-orm";
import type {
  IPayoutStatementRepository,
  PayoutStatementEntityRow,
  PayoutStatementLineRow,
  PayoutStatementPayoutRow,
} from "../interfaces/payout-statement.repository.js";

export class DrizzlePayoutStatementRepository implements IPayoutStatementRepository {
  constructor(private readonly db: Database) {}

  async findPayoutById(payoutId: string): Promise<PayoutStatementPayoutRow | null> {
    const [pRow] = await this.db.select().from(payout).where(eq(payout.id, payoutId)).limit(1);
    if (!pRow) return null;
    return {
      id: pRow.id,
      legalEntityId: pRow.legalEntityId,
      periodStart: pRow.periodStart,
      periodEnd: pRow.periodEnd,
      grossAmount: String(pRow.grossAmount),
      platformFee: String(pRow.platformFee),
      stripeFee: String(pRow.stripeFee),
      netAmount: String(pRow.netAmount),
      currency: pRow.currency,
      xeroBillId: pRow.xeroBillId,
      stripeTransferId: pRow.stripeTransferId,
      processedAt: pRow.processedAt,
    };
  }

  async findLegalEntityById(legalEntityId: string): Promise<PayoutStatementEntityRow | null> {
    const [entityRow] = await this.db
      .select()
      .from(legalEntity)
      .where(eq(legalEntity.id, legalEntityId))
      .limit(1);
    if (!entityRow) return null;
    return {
      id: entityRow.id,
      legalName: entityRow.legalName,
      displayName: entityRow.displayName,
      vatNumber: entityRow.vatNumber,
    };
  }

  async findPayoutLines(payoutId: string): Promise<PayoutStatementLineRow[]> {
    return this.db
      .select({
        lineId: payoutLine.id,
        kind: payoutLine.kind,
        amount: payoutLine.amount,
        note: payoutLine.note,
        paymentId: payoutLine.paymentId,
        createdByUserId: payoutLine.createdByUserId,
        lotTitle: lot.title,
        lotNumber: lot.lotNumber,
        buyerName: bidIdentityDirectory.name,
      })
      .from(payoutLine)
      .leftJoin(payment, eq(payoutLine.paymentId, payment.id))
      .leftJoin(lot, eq(payment.lotId, lot.id))
      .leftJoin(bidIdentityDirectory, eq(payment.buyerId, bidIdentityDirectory.subjectId))
      .where(eq(payoutLine.payoutId, payoutId));
  }

  async findAuthorNames(userIds: string[]): Promise<Map<string, string>> {
    const authorMap = new Map<string, string>();
    if (userIds.length === 0) return authorMap;
    const authors = await this.db
      .select({ id: bidIdentityDirectory.subjectId, name: bidIdentityDirectory.name })
      .from(bidIdentityDirectory)
      .where(inArray(bidIdentityDirectory.subjectId, userIds));
    for (const author of authors) {
      authorMap.set(author.id, author.name);
    }
    return authorMap;
  }

  async markStatementGenerated(payoutId: string, url: string): Promise<void> {
    await this.db
      .update(payout)
      .set({ statementUrl: url, statementGenerationError: null })
      .where(eq(payout.id, payoutId));
  }

  async markStatementError(payoutId: string, message: string): Promise<void> {
    await this.db
      .update(payout)
      .set({ statementGenerationError: message.slice(0, 4000) })
      .where(eq(payout.id, payoutId));
  }
}
