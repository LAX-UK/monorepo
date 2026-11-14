import type { TargetMode } from "@auction/accounting-domain";
import type { Database } from "@auction/db";
import { accountingDocument, accountingDocumentEvent } from "@auction/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import type {
  AccountingClock,
  CreditNoteRefundDue,
  CreditNoteRefundDueList,
  CreditNoteRefundRecord,
  IAccountingCreditNoteRefunds,
} from "../../interfaces/accounting.js";
import {
  MONEY_BACK_CREDIT_NOTE,
  REFUND_CREDIT_NOTE,
  REFUND_UNSETTLED,
} from "../../lib/accounting-credit-note-refund-due.js";
import { rowToStored } from "../../lib/accounting-document-row.js";

const d = accountingDocument;
const e = accountingDocumentEvent;

export { REFUND_CREDIT_NOTE };

/**
 * Issued credit notes whose money went back to the buyer, refunded in the books from Stripe
 * clearing once each. The step runs while this worker holds the credit note and is recorded in
 * its history (`refund_credit_note`) in the same transaction, so it is settled once whatever runs.
 */
export class DrizzleAccountingCreditNoteRefunds implements IAccountingCreditNoteRefunds {
  constructor(
    private readonly db: Database,
    private readonly clock: AccountingClock,
  ) {}

  async listDue(modes: readonly TargetMode[], limit: number): Promise<CreditNoteRefundDueList> {
    if (modes.length === 0 || limit <= 0) return { due: [], unreadable: [] };
    const rows = await this.db
      .select()
      .from(d)
      .where(
        and(
          MONEY_BACK_CREDIT_NOTE,
          eq(d.state, "issued"),
          eq(d.targetProvider, "books"),
          inArray(d.targetMode, [...modes]),
          REFUND_UNSETTLED,
        ),
      )
      // Least recently touched first: one whose last answer was unknown goes behind the others.
      .orderBy(asc(d.updatedAt), asc(d.id))
      .limit(limit);
    const nowMs = this.clock.now().getTime();
    const due: CreditNoteRefundDue[] = [];
    const unreadable: string[] = [];
    for (const row of rows) {
      const stored = rowToStored(row, nowMs);
      if (!stored.ok) {
        unreadable.push(row.id);
        continue;
      }
      due.push({ creditNote: stored.value });
    }
    return { due, unreadable };
  }

  async settleExclusively(
    creditNoteDocumentId: string,
    step: () => Promise<CreditNoteRefundRecord | null>,
  ): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      // Held for the step only; a worker that finds it held leaves it to the holder. Checked
      // again under the lock: a credit note settled meanwhile is not refunded twice.
      const [held] = await tx
        .select({ id: d.id, attempts: d.attempts })
        .from(d)
        .where(
          and(
            eq(d.id, creditNoteDocumentId),
            MONEY_BACK_CREDIT_NOTE,
            eq(d.state, "issued"),
            REFUND_UNSETTLED,
          ),
        )
        .for("update", { skipLocked: true });
      if (!held) return false;
      const record = await step();
      if (record === null) {
        // No answer to record: note the attempt, so the next run tries the others first.
        await tx.update(d).set({ updatedAt: this.clock.now() }).where(eq(d.id, held.id));
        return false;
      }
      await tx.insert(e).values({
        documentId: held.id,
        action: REFUND_CREDIT_NOTE,
        fromState: "issued",
        toState: "issued",
        attempts: held.attempts,
        detail: {
          outcome: record.outcome,
          amountPence: record.amountPence,
          account: record.account,
          rehearsal: record.rehearsal,
          ...(record.reason ? { reason: record.reason } : {}),
        },
        occurredAt: this.clock.now(),
      });
      return true;
    });
  }
}
