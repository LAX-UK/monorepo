import type { Database } from "@auction/db";
import { purchaseProblem } from "@auction/db/schema";
import type { PurchaseProblemCategory, PurchaseProblemStatus } from "@auction/domain";
import { and, eq } from "drizzle-orm";
import type {
  IPurchaseProblemRepository,
  NewPurchaseProblem,
  PurchaseProblemRecord,
} from "../interfaces/purchase-problem.repository.js";

function toRecord(row: typeof purchaseProblem.$inferSelect): PurchaseProblemRecord {
  return {
    id: row.id,
    lotId: row.lotId,
    buyerLegalEntityId: row.buyerLegalEntityId,
    paymentId: row.paymentId,
    status: row.status as PurchaseProblemStatus,
    category: row.category as PurchaseProblemCategory,
    message: row.message,
    reportedByUserId: row.reportedByUserId,
    createdAt: row.createdAt,
  };
}

function openCondition(lotId: string, buyerLegalEntityId: string) {
  return and(
    eq(purchaseProblem.lotId, lotId),
    eq(purchaseProblem.buyerLegalEntityId, buyerLegalEntityId),
    eq(purchaseProblem.status, "open"),
  );
}

export class DrizzlePurchaseProblemRepository implements IPurchaseProblemRepository {
  constructor(private readonly db: Database) {}

  async findOpen(lotId: string, buyerLegalEntityId: string): Promise<PurchaseProblemRecord | null> {
    const [row] = await this.db
      .select()
      .from(purchaseProblem)
      .where(openCondition(lotId, buyerLegalEntityId))
      .limit(1);
    return row ? toRecord(row) : null;
  }

  async openInTransaction(
    tx: Database,
    input: NewPurchaseProblem,
  ): Promise<{ record: PurchaseProblemRecord; created: boolean }> {
    // The partial unique index decides a race between two reports; the loser reads the winner.
    const [inserted] = await tx
      .insert(purchaseProblem)
      .values(input)
      .onConflictDoNothing()
      .returning();
    if (inserted) return { record: toRecord(inserted), created: true };
    const [existing] = await tx
      .select()
      .from(purchaseProblem)
      .where(openCondition(input.lotId, input.buyerLegalEntityId))
      .limit(1);
    if (!existing) throw new Error("purchase problem vanished after a conflicting insert");
    return { record: toRecord(existing), created: false };
  }
}
