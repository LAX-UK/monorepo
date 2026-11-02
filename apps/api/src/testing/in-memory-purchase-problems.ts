import type {
  IPurchaseProblemRepository,
  NewPurchaseProblem,
  PurchaseProblemRecord,
} from "@auction/persistence/interfaces";
import { NOW } from "./in-memory-workspace-buying.js";

/** Reported purchase problems in memory, with the one-open-report-per-purchase rule. */
export class InMemoryPurchaseProblems implements IPurchaseProblemRepository {
  readonly rows: PurchaseProblemRecord[] = [];

  async findOpen(lotId: string, account: string) {
    return (
      this.rows.find(
        (r) => r.lotId === lotId && r.buyerLegalEntityId === account && r.status === "open",
      ) ?? null
    );
  }

  async openInTransaction(_tx: unknown, input: NewPurchaseProblem) {
    const existing = await this.findOpen(input.lotId, input.buyerLegalEntityId);
    if (existing) return { record: existing, created: false };
    const record: PurchaseProblemRecord = {
      ...input,
      id: `3f2a9c1e-7b4d-4e0a-9d1f-${String(this.rows.length + 1).padStart(12, "0")}`,
      status: "open",
      createdAt: NOW,
    };
    this.rows.push(record);
    return { record, created: true };
  }
}
