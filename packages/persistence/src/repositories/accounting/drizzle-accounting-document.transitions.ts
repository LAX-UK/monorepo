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
import { readReleaseBasis } from "../../lib/accounting-release-basis.js";

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
      if (transition.action === "release" && transition.basis) {
        // The rows the release was decided on, held until this move commits: refused if they
        // changed since the decision (a Bid invoice voided again, a group's delivery changed).
        const now = await readReleaseBasis(tx, transition.basis.of, true);
        if (now === null || now !== transition.basis.read) {
          return refuse("basis_changed", "the rows the release was decided on have changed");
        }
      }
      return applyLockedTransition(tx, row, transition, at);
    });
  }
}
