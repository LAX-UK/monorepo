import { accountingDocument, accountingDocumentEvent } from "@auction/db/schema";
import { and, eq, notExists, sql } from "drizzle-orm";

const d = accountingDocument;
const e = accountingDocumentEvent;

/** The history action that settles a credit note's refund (migration 0385). */
export const REFUND_CREDIT_NOTE = "refund_credit_note";

/** Credit notes that give money back: the domain put `refund` on them (`planCreditNoteRefund`). */
export const MONEY_BACK_CREDIT_NOTE = and(
  eq(d.kind, "credit_note"),
  sql`jsonb_typeof(${d.payload} -> 'refund') = 'object'`,
);

/** No `refund_credit_note` in the credit note's history yet. */
export const REFUND_UNSETTLED = notExists(
  sql`(select 1 from ${e} where ${e.documentId} = ${d.id} and ${e.action} = ${REFUND_CREDIT_NOTE})`,
);
