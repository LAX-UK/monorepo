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
  type VendorPort,
  ZohoBillGateway,
  ZohoContactGateway,
  ZohoCreditNoteGateway,
  ZohoInvoiceGateway,
  ZohoPaymentGateway,
  ZohoVendorGateway,
} from "./gateways.js";
import { ZohoDocumentLookup } from "./lookup.js";
import type { ZohoOrgConfigs } from "./org-config.js";
import { DRY_RUN, WriteGate, type ZohoWriteMode } from "./write-gate.js";
import { DocumentWriter } from "./writer.js";

export * from "./org-config.js";
export { DRY_RUN_NUMBER, createZohoBooksDryRunAdapter, dryRunProviderId } from "./dry-run.js";
export * from "./rejections.js";
export { penceToPounds, poundsToPence } from "./money-format.js";
export { booksLineVat } from "./mappers/common.js";
export { contactReferenceValue, type ContactType } from "./mappers/contact.js";
export { orgFor, type OrgChoice, type ZohoApi } from "./api.js";
export type { VendorPort } from "./gateways.js";
export { DRY_RUN, type ZohoWriteMode } from "./write-gate.js";

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

/**
 * Builds the Books implementation of the accounting ports. Stateless: it holds the client and the
 * organisation settings, nothing per document, so any number of workers can use their own.
 * `orgs` must come from `parseOrgConfigs`, which checks it at start-up.
 *
 * `writes` defaults to dry-run: every create and update is refused with
 * `zoho_books_writes_disabled` before any request is sent. Writing needs an explicit `test_org` or
 * `live` mode and the Books organisation ids it may write to.
 */
export function createZohoBooksAdapter(deps: {
  readonly api: ZohoApi;
  readonly orgs: ZohoOrgConfigs;
  readonly writes?: ZohoWriteMode;
}): AccountingPorts {
  const gate = new WriteGate(deps.writes ?? DRY_RUN, deps.orgs);
  const api = gate.guard(deps.api);
  const lookup = new ZohoDocumentLookup(api, deps.orgs);
  const writer = new DocumentWriter(api, lookup);
  const gateway = { orgs: deps.orgs, lookup, writer, gate };
  return {
    invoices: new ZohoInvoiceGateway(gateway),
    payments: new ZohoPaymentGateway(gateway),
    creditNotes: new ZohoCreditNoteGateway(gateway),
    bills: new ZohoBillGateway(gateway),
    contacts: new ZohoContactGateway(gateway, api),
    vendors: new ZohoVendorGateway(gateway, api),
    lookup,
  };
}
