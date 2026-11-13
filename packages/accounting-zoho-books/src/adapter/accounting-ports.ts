import type {
  BillPort,
  ContactPort,
  CreditNotePort,
  DocumentLookupPort,
  InvoicePort,
  PaymentPort,
} from "@auction/accounting-domain";
import type { VendorPort } from "./gateways.js";

/** One port per document kind. A caller takes only the ports it needs (interface segregation). */
export interface AccountingPorts {
  readonly invoices: InvoicePort;
  readonly payments: PaymentPort;
  readonly creditNotes: CreditNotePort;
  readonly bills: BillPort;
  /** Customers. */
  readonly contacts: ContactPort;
  /** Vendors (payout recipients); a bill is only ever sent to one of these. */
  readonly vendors: VendorPort;
  readonly lookup: DocumentLookupPort;
}
