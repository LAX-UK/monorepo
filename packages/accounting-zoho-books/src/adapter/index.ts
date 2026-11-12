import type {
  BillPort,
  ContactPort,
  CreditNotePort,
  DocumentLookupPort,
  InvoicePort,
  PaymentPort,
} from "@auction/accounting-domain";
import type { ZohoApi } from "./api.js";
import {
  ZohoBillGateway,
  ZohoContactGateway,
  ZohoCreditNoteGateway,
  ZohoInvoiceGateway,
  ZohoPaymentGateway,
} from "./gateways.js";
import { ZohoDocumentLookup } from "./lookup.js";
import type { ZohoOrgConfigs } from "./org-config.js";
import { DocumentWriter } from "./writer.js";

export * from "./org-config.js";
export { penceToPounds, poundsToPence } from "./money-format.js";
export type { ZohoApi } from "./api.js";

/** One port per document kind. A caller takes only the ports it needs (interface segregation). */
export interface AccountingPorts {
  readonly invoices: InvoicePort;
  readonly payments: PaymentPort;
  readonly creditNotes: CreditNotePort;
  readonly bills: BillPort;
  readonly contacts: ContactPort;
  readonly lookup: DocumentLookupPort;
}

/**
 * Builds the Books implementation of the accounting ports. Stateless: it holds the client and the
 * organisation settings, nothing per document, so any number of workers can use their own.
 * `orgs` must come from `parseOrgConfigs`, which checks it at start-up.
 */
export function createZohoBooksAdapter(deps: {
  readonly api: ZohoApi;
  readonly orgs: ZohoOrgConfigs;
}): AccountingPorts {
  const lookup = new ZohoDocumentLookup(deps.api, deps.orgs);
  const writer = new DocumentWriter(deps.api, lookup);
  const gateway = { orgs: deps.orgs, lookup, writer };
  return {
    invoices: new ZohoInvoiceGateway(gateway),
    payments: new ZohoPaymentGateway(gateway),
    creditNotes: new ZohoCreditNoteGateway(gateway),
    bills: new ZohoBillGateway(gateway),
    contacts: new ZohoContactGateway(gateway, deps.api),
    lookup,
  };
}
