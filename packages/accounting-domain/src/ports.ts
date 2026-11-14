import type {
  AccountingDocument,
  Bill,
  Contact,
  CreditNote,
  Invoice,
  Payment,
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

/**
 * What a provider call can end in. `unknown` covers timeouts and anything we cannot tell.
 * `differs` means the provider holds a document under our reference (just created, or adopted
 * after a duplicate refusal) but, read back, it is not the one we sent: it exists, so it is never
 * sent again or treated as a refusal, and a person decides what to do with it.
 */
export type IssueOutcome =
  | ({ readonly status: "issued" } & ProviderDocument)
  | ({ readonly status: "differs"; readonly reason: string } & ProviderDocument)
  | { readonly status: "rejected"; readonly reason: string }
  | { readonly status: "unknown"; readonly detail?: string };

/**
 * What a lookup by LAX reference found. `differs` is the lookup's `differs`: the provider holds a
 * document under our reference, but read back it is not the one we would send (checked field by
 * field, the same check a send makes), so it goes to a person with the provider's identity.
 */
export type LookupOutcome =
  | ({ readonly status: "found" } & ProviderDocument)
  | ({ readonly status: "differs"; readonly reason: string } & ProviderDocument)
  | { readonly status: "not_found" }
  | { readonly status: "ambiguous"; readonly count: number }
  | { readonly status: "unavailable"; readonly reason: string };

/**
 * Ties a send's writes to its lease. An adapter asks it immediately before every request that
 * writes (a create or an update, and each retry of one), after any wait for a rate limit, a
 * concurrency slot or a backoff. `false` means the send no longer holds its lease with room to
 * finish (`WRITE_MARGIN_MS`): the request is not sent and the call ends `rejected` (nothing was
 * written), never a create that could race the next holder's. A send given no fence writes
 * unfenced; the sender always gives one.
 */
export interface WriteFence {
  mayWrite(): Promise<boolean>;
}

export interface InvoicePort {
  issueInvoice(invoice: Invoice, fence?: WriteFence): Promise<IssueOutcome>;
}

export interface PaymentPort {
  recordPayment(payment: Payment, fence?: WriteFence): Promise<IssueOutcome>;
}

export interface CreditNotePort {
  issueCreditNote(creditNote: CreditNote, fence?: WriteFence): Promise<IssueOutcome>;
}

export interface BillPort {
  issueBill(bill: Bill, fence?: WriteFence): Promise<IssueOutcome>;
}

export interface ContactPort {
  upsertContact(contact: Contact, fence?: WriteFence): Promise<IssueOutcome>;
}

/**
 * Find a document by its LAX reference. After an unknown outcome this runs before any retry, and
 * only once the first request can no longer land (see `applyLookup`). The document's product says
 * which legal entity's books to search, so an adapter can never look in the wrong organisation.
 * What it finds is read back against `document` with the same check a send makes (not its totals
 * alone): a document that is not the one we would send is `differs`, never `found`, so an answer
 * lost on the way back (a timeout, a swept lease) cannot turn a differing document into an
 * issued one.
 */
export interface DocumentLookupPort {
  findDocument(document: AccountingDocument): Promise<LookupOutcome>;
}

/**
 * What fetching a document's rendered PDF ended in. `fetched` carries the bytes; `rehearsal` is
 * true when they were made by a dry run (a stand-in that says so on the page), never by the
 * provider. `unavailable` changes nothing: the copy is fetched again on a later tick.
 */
export type PdfOutcome =
  | {
      readonly status: "fetched";
      readonly bytes: Uint8Array;
      readonly contentType: "application/pdf";
      readonly rehearsal: boolean;
    }
  | { readonly status: "unavailable"; readonly reason: string };

/**
 * The provider's PDF of a document it issued, so LAX can keep its own copy. Asked only for a
 * document whose record is `issued`, with the identity the provider gave it; a reader never
 * reaches the provider through this (buyers download the stored copy).
 */
export interface DocumentPdfPort {
  fetchPdf(document: AccountingDocument, issued: IssuedDocument): Promise<PdfOutcome>;
}
