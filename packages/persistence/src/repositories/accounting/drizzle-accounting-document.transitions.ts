import { type Result, refuse } from "@auction/accounting-domain";
import type { Database } from "@auction/db";
import { accountingDocument } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type {
  AccountingClock,
  DocumentTransition,
  IAccountingDocumentTransitions,
  StoredAccountingDocument,
  TransitionCode,
} from "../../interfaces/accounting.js";
import { applyLockedTransition } from "../../lib/accounting-document-move.js";

export class DrizzleAccountingDocumentTransitions implements IAccountingDocumentTransitions {
  constructor(
    private readonly db: Database,
    private readonly clock: AccountingClock,
  ) {}

  apply(
    documentId: string,
    transition: DocumentTransition,
  ): Promise<Result<StoredAccountingDocument, TransitionCode>> {
    const at = this.clock.now();
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(accountingDocument)
        .where(eq(accountingDocument.id, documentId))
        .for("update");
      if (!row) return refuse("not_found", "no such document");
      return applyLockedTransition(tx, row, transition, at);
    });
  }
}
