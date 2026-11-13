import {
  type AccountingDocument,
  type Bill,
  type Contact,
  type CreditNote,
  type Invoice,
  type IssueOutcome,
  type LookupOutcome,
  type Payment,
  type Result,
  expectedTotals,
} from "@auction/accounting-domain";
import type { AccountingPorts } from "./accounting-ports.js";
import { orgFor } from "./api.js";
import type { VendorPort } from "./gateways.js";
import { billBody } from "./mappers/bill.js";
import { type ContactType, contactCreateBody } from "./mappers/contact.js";
import { creditNoteBody } from "./mappers/credit-note.js";
import { invoiceBody } from "./mappers/invoice.js";
import { paymentBody } from "./mappers/payment.js";
import type { ZohoOrgConfig, ZohoOrgConfigs } from "./org-config.js";
import { type Dependency, sameProduct } from "./resolve.js";

/** The Books id a dependency would have; never sent anywhere, only lets a mapper build its body. */
const PLACEHOLDER_ID = "0";

/** The number every rehearsed document carries, so no one can mistake it for a Books number. */
export const DRY_RUN_NUMBER = "DRY-RUN";

/** The provider id a rehearsed document is recorded under: plainly not a Books id. */
export function dryRunProviderId(reference: string): string {
  return `dry-run:${reference}`;
}

type Built = Result<unknown, string>;

/**
 * Books in rehearsal: every port builds the exact request the Books adapter would send (same
 * organisation choice, same dependency checks, same mappers, so the same VAT and basis refusals)
 * and then sends nothing. There is no HTTP client in it at all, so it cannot reach Zoho whatever it
 * is handed. A document whose request can be built is answered `issued` under a rehearsal
 * identity (`DRY-RUN`, `dry-run:<reference>`) with our own totals; one that cannot is `rejected`
 * with the adapter's own reason, exactly as Books mode would refuse it. Nothing is held, so a
 * lookup always finds nothing: nothing was ever written.
 *
 * The request body itself is not kept: it carries names and emails, and the document history it
 * would go into is append-only.
 */
export function createZohoBooksDryRunAdapter(deps: {
  readonly orgs: ZohoOrgConfigs;
}): AccountingPorts {
  const rehearse = (
    doc: AccountingDocument,
    dependencies: readonly Dependency[],
    build: (org: ZohoOrgConfig) => Built,
  ): Promise<IssueOutcome> => Promise.resolve(rehearsal(deps.orgs, doc, dependencies, build));

  const contact = (type: ContactType) => (c: Contact) =>
    rehearse(c, [], (org) => ({ ok: true, value: contactCreateBody(c, type, org) }));
  const vendors: VendorPort = { upsertVendor: contact("vendor") };

  return {
    invoices: {
      issueInvoice: (d: Invoice) =>
        rehearse(d, [customer(d.contactReference)], (org) => invoiceBody(d, PLACEHOLDER_ID, org)),
    },
    creditNotes: {
      issueCreditNote: (d: CreditNote) =>
        rehearse(
          d,
          [customer(d.contactReference), { kind: "invoice", reference: d.invoiceReference }],
          (org) => creditNoteBody(d, PLACEHOLDER_ID, org),
        ),
    },
    payments: {
      recordPayment: (d: Payment) =>
        rehearse(
          d,
          [
            customer(d.contactReference),
            ...d.allocations.map(
              (a): Dependency => ({ kind: "invoice", reference: a.invoiceReference }),
            ),
          ],
          (org) =>
            paymentBody(
              d,
              PLACEHOLDER_ID,
              new Map(d.allocations.map((a) => [a.invoiceReference, PLACEHOLDER_ID])),
              org,
            ),
        ),
    },
    bills: {
      issueBill: (d: Bill) =>
        rehearse(
          d,
          [{ kind: "contact", reference: d.contactReference, contactType: "vendor" }],
          (org) => billBody(d, PLACEHOLDER_ID, org),
        ),
    },
    contacts: { upsertContact: contact("customer") },
    vendors,
    lookup: {
      findByReference: (): Promise<LookupOutcome> => Promise.resolve({ status: "not_found" }),
    },
  };
}

function customer(reference: string): Dependency {
  return { kind: "contact", reference, contactType: "customer" };
}

function rehearsal(
  orgs: ZohoOrgConfigs,
  doc: AccountingDocument,
  dependencies: readonly Dependency[],
  build: (org: ZohoOrgConfig) => Built,
): IssueOutcome {
  const choice = orgFor(orgs, doc);
  if (!choice.ok) return { status: "rejected", reason: choice.reason };
  const foreign = sameProduct(doc.product, dependencies);
  if (foreign) return foreign;
  const body = build(choice.org);
  if (!body.ok) return { status: "rejected", reason: `zoho_books_mapping_${body.refusal.code}` };
  return {
    status: "issued",
    number: DRY_RUN_NUMBER,
    providerId: dryRunProviderId(doc.reference),
    pdfRef: null,
    totals: expectedTotals(doc),
  };
}
