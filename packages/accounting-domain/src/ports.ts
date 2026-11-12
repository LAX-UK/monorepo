import type { Bill, Contact, CreditNote, DocumentKind, Invoice, Payment } from "./document.js";

/** The provider's identity for a document it accepted. */
export interface IssuedDocument {
  /** The provider's human document number, e.g. INV-0042. */
  readonly number: string;
  /** The provider's own id for the document. */
  readonly providerId: string;
  /** Reference to the rendered PDF, when the provider has one. */
  readonly pdfRef: string | null;
}

/** What a provider call can end in. `unknown` covers timeouts and anything we cannot tell. */
export type IssueOutcome =
  | ({ readonly status: "issued" } & IssuedDocument)
  | { readonly status: "rejected"; readonly reason: string }
  | { readonly status: "unknown"; readonly detail?: string };

export type LookupOutcome =
  | ({ readonly status: "found" } & IssuedDocument)
  | { readonly status: "not_found" }
  | { readonly status: "ambiguous"; readonly count: number }
  | { readonly status: "unavailable"; readonly reason: string };

export interface InvoicePort {
  issueInvoice(invoice: Invoice): Promise<IssueOutcome>;
}

export interface PaymentPort {
  recordPayment(payment: Payment): Promise<IssueOutcome>;
}

export interface CreditNotePort {
  issueCreditNote(creditNote: CreditNote): Promise<IssueOutcome>;
}

export interface BillPort {
  issueBill(bill: Bill): Promise<IssueOutcome>;
}

export interface ContactPort {
  upsertContact(contact: Contact): Promise<IssueOutcome>;
}

/** Find a document by its LAX reference. After an unknown outcome this runs before any retry. */
export interface DocumentLookupPort {
  findByReference(kind: DocumentKind, reference: string): Promise<LookupOutcome>;
}
