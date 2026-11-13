import type { AccountingDocument } from "./document.js";

/**
 * The documents that must be in the books before this one may be sent, by LAX reference: a
 * payment waits for every invoice it is applied to. The work queue claims a payment only once each
 * of these is issued for the same target, so a payment never reaches Books before its invoice
 * (it would be refused, or land as unapplied credit) and never blocks the documents behind it.
 * The claim query (`DrizzleAccountingDocumentWorkQueue`) states the same rule in SQL.
 */
export function documentsAwaited(document: AccountingDocument): readonly string[] {
  return document.kind === "payment" ? document.allocations.map((a) => a.invoiceReference) : [];
}
