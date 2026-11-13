import type {
  AccountingDocument,
  BillPort,
  ContactPort,
  CreditNotePort,
  DestinationPort,
  DocumentLookupPort,
  InvoicePort,
  IssueOutcome,
  PaymentPort,
} from "@auction/accounting-domain";

/**
 * The ports a sender sends through, one per document kind. Customers only: a vendor contact (for
 * a seller's bill) has no document of its own yet; it arrives with the payouts flow.
 */
export interface SenderPorts {
  readonly invoices: InvoicePort;
  readonly payments: PaymentPort;
  readonly creditNotes: CreditNotePort;
  readonly bills: BillPort;
  readonly contacts: ContactPort;
  readonly lookup: DocumentLookupPort;
  /** Where the adapter would send each product's documents; checked before every call. */
  readonly destination: DestinationPort;
}

type Senders = {
  readonly [K in AccountingDocument["kind"]]: (
    ports: SenderPorts,
    document: Extract<AccountingDocument, { kind: K }>,
  ) => Promise<IssueOutcome>;
};

/** One row per document kind; a new kind adds a row and a port. */
const SENDERS: Senders = {
  invoice: (ports, d) => ports.invoices.issueInvoice(d),
  payment: (ports, d) => ports.payments.recordPayment(d),
  credit_note: (ports, d) => ports.creditNotes.issueCreditNote(d),
  bill: (ports, d) => ports.bills.issueBill(d),
  contact: (ports, d) => ports.contacts.upsertContact(d),
};

/** Hand a document to the port for its kind. */
export function sendThrough(
  ports: SenderPorts,
  document: AccountingDocument,
): Promise<IssueOutcome> {
  const send = SENDERS[document.kind] as (
    p: SenderPorts,
    d: AccountingDocument,
  ) => Promise<IssueOutcome>;
  return send(ports, document);
}
