import { accountingDocument, accountingDocumentEvent } from "@auction/db/schema";
import { and, eq, notExists, sql } from "drizzle-orm";

const d = accountingDocument;
const e = accountingDocumentEvent;

/** The history action that settles a credit note's refund (migration 0385). */
export const REFUND_CREDIT_NOTE = "refund_credit_note";

/**
 * The reason a credit note is held for a person when Books refused to refund it from Stripe
 * clearing (a `refund_credit_note` with outcome `rejected`): it is refunded by hand in Books.
 */
export const CREDIT_NOTE_REFUND_REFUSED = "accounting_credit_note_refund_refused";

/**
 * The reason a credit note is held for a person when the refund it credits was taken back after
 * it was issued (the projection's `refund_reversed_after_credit`, or the clearing-refund step's
 * own re-check): it must not be refunded from clearing, and nothing is refunded by hand.
 */
export const REFUND_REVERSED_AFTER_CREDIT = "accounting_refund_reversed_after_credit";

/** Credit notes that give money back: the domain put `refund` on them (`planCreditNoteRefund`). */
export const MONEY_BACK_CREDIT_NOTE = and(
  eq(d.kind, "credit_note"),
  sql`jsonb_typeof(${d.payload} -> 'refund') = 'object'`,
);

/** No `refund_credit_note` in the credit note's history yet. */
export const REFUND_UNSETTLED = notExists(
  sql`(select 1 from ${e} where ${e.documentId} = ${d.id} and ${e.action} = ${REFUND_CREDIT_NOTE})`,
);
