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
  WriteFence,
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
    fence: WriteFence,
  ) => Promise<IssueOutcome>;
};

/** One row per document kind; a new kind adds a row and a port. */
const SENDERS: Senders = {
  invoice: (ports, d, fence) => ports.invoices.issueInvoice(d, fence),
  payment: (ports, d, fence) => ports.payments.recordPayment(d, fence),
  credit_note: (ports, d, fence) => ports.creditNotes.issueCreditNote(d, fence),
  bill: (ports, d, fence) => ports.bills.issueBill(d, fence),
  contact: (ports, d, fence) => ports.contacts.upsertContact(d, fence),
};

/** Hand a document to the port for its kind; its writes go out only while `fence` allows. */
export function sendThrough(
  ports: SenderPorts,
  document: AccountingDocument,
  fence: WriteFence,
): Promise<IssueOutcome> {
  const send = SENDERS[document.kind] as (
    p: SenderPorts,
    d: AccountingDocument,
    f: WriteFence,
  ) => Promise<IssueOutcome>;
  return send(ports, document, fence);
}
