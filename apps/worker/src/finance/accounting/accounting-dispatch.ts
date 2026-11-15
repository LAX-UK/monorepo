import {
  type AccountingDocument,
  type BillPaymentPort,
  type BillPort,
  type ContactPort,
  type CreditNotePort,
  type DestinationPort,
  type DocumentLookupPort,
  type ExpensePort,
  type InvoicePort,
  type IssueOutcome,
  type PaymentPort,
  type TransferPort,
  type VendorPort,
  type WriteFence,
  contactPartyOf,
} from "@auction/accounting-domain";

/**
 * The ports a sender sends through, one per document kind. A contact goes to the customers or the
 * vendors by the party its reference names (`contactPartyOf`): a payee's vendor contact
 * (`LAX-<P>-CON-vendor-…`) is only ever a vendor, so a bill is never sent to a customer.
 */
export interface SenderPorts {
  readonly invoices: InvoicePort;
  readonly payments: PaymentPort;
  readonly creditNotes: CreditNotePort;
  readonly bills: BillPort;
  /** A payout paid: the payee's bill paid in full from Stripe clearing. */
  readonly billPayments: BillPaymentPort;
  /** Stripe's fees, paid from the Stripe clearing account. */
  readonly expenses: ExpensePort;
  /** Stripe payouts, from the Stripe clearing account to the bank. */
  readonly transfers: TransferPort;
  readonly contacts: ContactPort;
  /** The people LAX pays (sellers and artists); kept apart from the customers in Books. */
  readonly vendors: VendorPort;
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
  contact: (ports, d, fence) =>
    contactPartyOf(d.reference) === "vendor"
      ? ports.vendors.upsertVendor(d, fence)
      : ports.contacts.upsertContact(d, fence),
  bill_payment: (ports, d, fence) => ports.billPayments.recordBillPayment(d, fence),
  expense: (ports, d, fence) => ports.expenses.recordExpense(d, fence),
  transfer: (ports, d, fence) => ports.transfers.recordTransfer(d, fence),
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
