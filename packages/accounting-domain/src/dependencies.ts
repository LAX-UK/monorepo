import type { AccountingDocument } from "./document.js";

/**
 * The documents that must be in the books before this one may be sent, by LAX reference:
 * - an invoice or credit note waits for its contact (Books refuses one whose contact it does not
 *   hold, and the refusal would need a person);
 * - a payment waits for its contact and for every invoice it is applied to (it would be refused,
 *   or land as unapplied credit). The contact is named on its own, so a payment that applies
 *   nothing yet (or whose invoices are elsewhere) still follows it.
 * The work queue claims a document only once each of these is issued for the same target, so the
 * order holds whatever order the documents were stored in and however many senders run, and a
 * waiting document never blocks the documents behind it. The claim query
 * (`DrizzleAccountingDocumentWorkQueue`) states the same rule in SQL.
 */
export function documentsAwaited(document: AccountingDocument): readonly string[] {
  switch (document.kind) {
    case "payment":
      return [document.contactReference, ...document.allocations.map((a) => a.invoiceReference)];
    case "invoice":
    case "credit_note":
      return [document.contactReference];
    default:
      return [];
  }
}
