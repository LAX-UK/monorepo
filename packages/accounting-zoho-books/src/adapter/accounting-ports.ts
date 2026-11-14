import type {
  BillPort,
  ContactPort,
  CreditNotePort,
  DestinationPort,
  DocumentLookupPort,
  DocumentPdfPort,
  DocumentStatusPort,
  InvoicePort,
  PaymentPort,
  PaymentRemainderPort,
} from "@auction/accounting-domain";
import type { VendorPort } from "./gateways.js";

/** One port per document kind. A caller takes only the ports it needs (interface segregation). */
export interface AccountingPorts {
  readonly invoices: InvoicePort;
  readonly payments: PaymentPort;
  /** Applies a payment's unapplied rest to an invoice issued after it (a released delivery). */
  readonly remainders: PaymentRemainderPort;
  readonly creditNotes: CreditNotePort;
  readonly bills: BillPort;
  /** Customers. */
  readonly contacts: ContactPort;
  /** Vendors (payout recipients); a bill is only ever sent to one of these. */
  readonly vendors: VendorPort;
  readonly lookup: DocumentLookupPort;
  /** The PDF of an issued invoice or credit note, for LAX's own stored copy. */
  readonly pdfs: DocumentPdfPort;
  /** Reads an issued document's state back (the nightly status check). Read only. */
  readonly statuses: DocumentStatusPort;
  /** Which organisation each product's documents would go to, asked before anything is sent. */
  readonly destination: DestinationPort;
}
