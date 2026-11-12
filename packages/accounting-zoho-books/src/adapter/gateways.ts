import type {
  Bill,
  BillPort,
  Contact,
  ContactPort,
  CreditNote,
  CreditNotePort,
  DocumentLookupPort,
  Invoice,
  InvoicePort,
  IssueOutcome,
  Payment,
  PaymentPort,
  Result,
} from "@auction/accounting-domain";
import { toIssueFailure } from "../outcome.js";
import type { ZohoApi } from "./api.js";
import { KIND_SPECS, asRecord, readProviderDocument } from "./kinds.js";
import { billBody } from "./mappers/bill.js";
import { contactCreateBody, contactUpdateBody } from "./mappers/contact.js";
import { creditNoteBody } from "./mappers/credit-note.js";
import { invoiceBody } from "./mappers/invoice.js";
import { paymentBody } from "./mappers/payment.js";
import type { ZohoOrgConfig, ZohoOrgConfigs } from "./org-config.js";
import { resolveProviderId } from "./resolve.js";
import type { DocumentWriter } from "./writer.js";

type Refusal = Extract<IssueOutcome, { status: "rejected" | "unknown" }>;

export interface GatewayDeps {
  readonly orgs: ZohoOrgConfigs;
  readonly lookup: DocumentLookupPort;
  readonly writer: DocumentWriter;
}

const notConfigured: Refusal = {
  status: "rejected",
  reason: "zoho_books_organisation_not_configured",
};

/** A mapper that could not build a request: nothing was sent, a person decides. */
function mappingRefusal(refusal: { readonly code: string }): Refusal {
  return { status: "rejected", reason: `zoho_books_mapping_${refusal.code}` };
}

/** Unwrap a mapper result, or turn its refusal into the outcome to return. */
function mapped<T>(result: Result<T, string>): { body: T } | { stop: Refusal } {
  return result.ok ? { body: result.value } : { stop: mappingRefusal(result.refusal) };
}

export class ZohoInvoiceGateway implements InvoicePort {
  constructor(private readonly deps: GatewayDeps) {}

  async issueInvoice(invoice: Invoice): Promise<IssueOutcome> {
    const org = this.deps.orgs[invoice.entity];
    if (!org) return notConfigured;
    const customer = await resolveProviderId(
      this.deps.lookup,
      invoice.product,
      "contact",
      invoice.contactReference,
    );
    if (customer.status === "stop") return customer.outcome;
    const built = mapped(invoiceBody(invoice, customer.id, org));
    if ("stop" in built) return built.stop;
    return this.deps.writer.create({
      org,
      product: invoice.product,
      kind: "invoice",
      reference: invoice.reference,
      body: built.body,
    });
  }
}

export class ZohoCreditNoteGateway implements CreditNotePort {
  constructor(private readonly deps: GatewayDeps) {}

  async issueCreditNote(creditNote: CreditNote): Promise<IssueOutcome> {
    const org = this.deps.orgs[creditNote.entity];
    if (!org) return notConfigured;
    const { lookup } = this.deps;
    const customer = await resolveProviderId(
      lookup,
      creditNote.product,
      "contact",
      creditNote.contactReference,
    );
    if (customer.status === "stop") return customer.outcome;
    const invoice = await resolveProviderId(
      lookup,
      creditNote.product,
      "invoice",
      creditNote.invoiceReference,
    );
    if (invoice.status === "stop") return invoice.outcome;
    const built = mapped(creditNoteBody(creditNote, customer.id, org));
    if ("stop" in built) return built.stop;
    return this.deps.writer.create({
      org,
      product: creditNote.product,
      kind: "credit_note",
      reference: creditNote.reference,
      body: built.body,
      query: { invoice_id: invoice.id },
    });
  }
}

export class ZohoPaymentGateway implements PaymentPort {
  constructor(private readonly deps: GatewayDeps) {}

  async recordPayment(payment: Payment): Promise<IssueOutcome> {
    const org = this.deps.orgs[payment.entity];
    if (!org) return notConfigured;
    const { lookup } = this.deps;
    const customer = await resolveProviderId(
      lookup,
      payment.product,
      "contact",
      payment.contactReference,
    );
    if (customer.status === "stop") return customer.outcome;
    const invoiceIds = new Map<string, string>();
    for (const allocation of payment.allocations) {
      const invoice = await resolveProviderId(
        lookup,
        payment.product,
        "invoice",
        allocation.invoiceReference,
      );
      if (invoice.status === "stop") return invoice.outcome;
      invoiceIds.set(allocation.invoiceReference, invoice.id);
    }
    return this.deps.writer.create({
      org,
      product: payment.product,
      kind: "payment",
      reference: payment.reference,
      body: paymentBody(payment, customer.id, invoiceIds, org),
    });
  }
}

export class ZohoBillGateway implements BillPort {
  constructor(private readonly deps: GatewayDeps) {}

  async issueBill(bill: Bill): Promise<IssueOutcome> {
    const org = this.deps.orgs[bill.entity];
    if (!org) return notConfigured;
    const vendor = await resolveProviderId(
      this.deps.lookup,
      bill.product,
      "contact",
      bill.contactReference,
    );
    if (vendor.status === "stop") return vendor.outcome;
    const built = mapped(billBody(bill, vendor.id, org));
    if ("stop" in built) return built.stop;
    return this.deps.writer.create({
      org,
      product: bill.product,
      kind: "bill",
      reference: bill.reference,
      body: built.body,
    });
  }
}

/**
 * Create the contact, or bring the existing one's name up to date. Found by the LAX reference, so
 * one legal-entity id is one Books contact however often this runs.
 */
export class ZohoContactGateway implements ContactPort {
  constructor(
    private readonly deps: GatewayDeps,
    private readonly api: ZohoApi,
  ) {}

  async upsertContact(contact: Contact): Promise<IssueOutcome> {
    const org: ZohoOrgConfig | undefined = this.deps.orgs[contact.entity];
    if (!org) return notConfigured;
    const found = await this.deps.lookup.findByReference(
      contact.product,
      "contact",
      contact.reference,
    );
    switch (found.status) {
      case "not_found":
        return this.deps.writer.create({
          org,
          product: contact.product,
          kind: "contact",
          reference: contact.reference,
          body: contactCreateBody(contact, org),
        });
      case "found":
        return this.update(org, found.providerId, contact);
      case "ambiguous":
        return { status: "rejected", reason: "zoho_books_contact_ambiguous" };
      case "unavailable":
        return { status: "unknown", detail: found.reason };
    }
  }

  private async update(org: ZohoOrgConfig, id: string, contact: Contact): Promise<IssueOutcome> {
    const spec = KIND_SPECS.contact;
    const reply = await this.api.put(
      org.organizationId,
      `${spec.path}/${id}`,
      contactUpdateBody(contact),
    );
    if (!reply.ok) return toIssueFailure(reply.error);
    const doc = readProviderDocument(spec, asRecord(reply.value.body)?.[spec.itemKey]);
    return doc
      ? { status: "issued", ...doc }
      : { status: "unknown", detail: "zoho_books_unreadable_document" };
  }
}
