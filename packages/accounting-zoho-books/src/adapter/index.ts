import type { AccountingPorts } from "./accounting-ports.js";
import { type ZohoApi, booksDestination } from "./api.js";
import {
  ZohoBillGateway,
  ZohoContactGateway,
  ZohoCreditNoteGateway,
  ZohoInvoiceGateway,
  ZohoPaymentGateway,
  ZohoVendorGateway,
} from "./gateways.js";
import { ZohoDocumentLookup } from "./lookup.js";
import type { ZohoOrgConfigs } from "./org-config.js";
import { ZohoReadBackLookup } from "./read-back.js";
import { DRY_RUN, WriteGate, type ZohoWriteMode } from "./write-gate.js";
import { DocumentWriter } from "./writer.js";

export * from "./org-config.js";
export type { AccountingPorts } from "./accounting-ports.js";
export { DRY_RUN_NUMBER, createZohoBooksDryRunAdapter, dryRunProviderId } from "./dry-run.js";
export * from "./rejections.js";
export { penceToPounds, poundsToPence } from "./money-format.js";
export { booksLineVat } from "./mappers/common.js";
export { contactReferenceValue, type ContactType } from "./mappers/contact.js";
export { orgFor, type OrgChoice, type ZohoApi } from "./api.js";
export type { VendorPort } from "./gateways.js";
export { DRY_RUN, type ZohoWriteMode } from "./write-gate.js";
export { parseBooksDestinationBinding } from "./destination-binding.js";
export { BOOKS_ORGANISATIONS } from "./organisations.js";

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
    lookup: new ZohoReadBackLookup(lookup, deps.orgs),
    destination: booksDestination(deps.orgs),
  };
}
