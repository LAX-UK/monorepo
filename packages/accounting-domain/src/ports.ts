import type {
  Bill,
  Contact,
  CreditNote,
  DocumentKind,
  Invoice,
  Payment,
  Product,
} from "./document.js";
import type { Totals } from "./money.js";

/** The provider's identity for a document it accepted. */
export interface IssuedDocument {
  /** The provider's human document number, e.g. INV-0042. */
  readonly number: string;
  /** The provider's own id for the document. */
  readonly providerId: string;
  /** Reference to the rendered PDF, when the provider has one. */
  readonly pdfRef: string | null;
}

/** What the provider says it holds: its identity for the document and the totals it computed. */
export interface ProviderDocument extends IssuedDocument {
  /** The provider's own totals, compared exactly with ours; a difference goes to review. */
  readonly totals: Totals;
}

/** What a provider call can end in. `unknown` covers timeouts and anything we cannot tell. */
export type IssueOutcome =
  | ({ readonly status: "issued" } & ProviderDocument)
  | { readonly status: "rejected"; readonly reason: string }
  | { readonly status: "unknown"; readonly detail?: string };

export type LookupOutcome =
  | ({ readonly status: "found" } & ProviderDocument)
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

/**
 * Find a document by its LAX reference. After an unknown outcome this runs before any retry, and
 * only once the first request can no longer land (see `applyLookup`). The product says which legal
 * entity's books to search, so an adapter can never look in the wrong organisation.
 */
export interface DocumentLookupPort {
  findByReference(product: Product, kind: DocumentKind, reference: string): Promise<LookupOutcome>;
}
