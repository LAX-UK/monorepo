import type {
  Bill,
  BillPort,
  Contact,
  ContactPort,
  CreditNote,
  CreditNotePort,
  Invoice,
  InvoicePort,
  IssueOutcome,
  Payment,
  PaymentPort,
  Product,
  Result,
} from "@auction/accounting-domain";
import { toIssueFailure } from "../outcome.js";
import { type ZohoApi, orgFor } from "./api.js";
import { KIND_SPECS, asRecord, readProviderDocument } from "./kinds.js";
import type { BooksRecord, ZohoDocumentLookup } from "./lookup.js";
import { billBody } from "./mappers/bill.js";
import {
  type ContactType,
  contactCreateBody,
  contactReferenceValue,
  contactUpdateBody,
} from "./mappers/contact.js";
import { creditNoteBody } from "./mappers/credit-note.js";
import { invoiceBody } from "./mappers/invoice.js";
import { type PaymentBody, paymentBody } from "./mappers/payment.js";
import { poundsToPence } from "./money-format.js";
import type { ZohoOrgConfig, ZohoOrgConfigs } from "./org-config.js";
import { ZOHO_BOOKS_REJECTIONS } from "./rejections.js";
import { type Dependency, type Stop, resolveProviderId, sameProduct } from "./resolve.js";
import type { WriteGate } from "./write-gate.js";
import type { DocumentWriter } from "./writer.js";

export interface GatewayDeps {
  readonly orgs: ZohoOrgConfigs;
  readonly lookup: ZohoDocumentLookup;
  readonly writer: DocumentWriter;
  readonly gate: WriteGate;
}

/** A mapper that could not build a request: nothing was sent, a person decides. */
function mappingRefusal(refusal: { readonly code: string }): Stop {
  return { status: "rejected", reason: `zoho_books_mapping_${refusal.code}` };
}

/** Unwrap a mapper result, or turn its refusal into the outcome to return. */
function mapped<T>(result: Result<T, string>): { body: T } | { stop: Stop } {
  return result.ok ? { body: result.value } : { stop: mappingRefusal(result.refusal) };
}

type Prepared = { readonly org: ZohoOrgConfig; readonly ids: readonly string[] } | { stop: Stop };

/**
 * Everything every document does before it is built, in one order: choose the organisation from
 * the document (refusing an entity that disagrees with the product), refuse writes the gate does
 * not allow, refuse dependencies of another product, then find each dependency in that same
 * organisation. Nothing is sent unless all of it passes.
 */
async function prepare(
  deps: GatewayDeps,
  doc: { readonly product: Product; readonly entity: Contact["entity"] },
  dependencies: readonly Dependency[],
): Promise<Prepared> {
  const choice = orgFor(deps.orgs, doc);
  if (!choice.ok) return { stop: { status: "rejected", reason: choice.reason } };
  const { org } = choice;
  if (!deps.gate.permits(org.organizationId)) {
    return { stop: { status: "rejected", reason: ZOHO_BOOKS_REJECTIONS.writesDisabled } };
  }
  const foreign = sameProduct(doc.product, dependencies);
  if (foreign) return { stop: foreign };
  const ids: string[] = [];
  for (const dependency of dependencies) {
    const resolved = await resolveProviderId(deps.lookup, org, doc.product, dependency);
    if (resolved.status === "stop") return { stop: resolved.outcome };
    ids.push(resolved.id);
  }
  return { org, ids };
}

export class ZohoInvoiceGateway implements InvoicePort {
  constructor(private readonly deps: GatewayDeps) {}

  async issueInvoice(invoice: Invoice): Promise<IssueOutcome> {
    const ready = await prepare(this.deps, invoice, [
      { kind: "contact", reference: invoice.contactReference, contactType: "customer" },
    ]);
    if ("stop" in ready) return ready.stop;
    const [customerId] = ready.ids as [string];
    const built = mapped(invoiceBody(invoice, customerId, ready.org));
    if ("stop" in built) return built.stop;
    return this.deps.writer.create({
      org: ready.org,
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
    const ready = await prepare(this.deps, creditNote, [
      { kind: "contact", reference: creditNote.contactReference, contactType: "customer" },
      { kind: "invoice", reference: creditNote.invoiceReference },
    ]);
    if ("stop" in ready) return ready.stop;
    const [customerId, invoiceId] = ready.ids as [string, string];
    const built = mapped(creditNoteBody(creditNote, customerId, ready.org));
    if ("stop" in built) return built.stop;
    return this.deps.writer.create({
      org: ready.org,
      product: creditNote.product,
      kind: "credit_note",
      reference: creditNote.reference,
      body: built.body,
      query: { invoice_id: invoiceId },
    });
  }
}

/**
 * The payment Books holds is ours only if it applies the same amounts to the same invoices, in the
 * same currency, on the same date, for the same customer. Its total alone is not enough.
 */
export function paymentMatches(sent: PaymentBody, item: BooksRecord): boolean {
  if (item.customer_id !== sent.customer_id) return false;
  if (item.date !== sent.date || item.currency_code !== sent.currency_code) return false;
  if (poundsToPence(item.amount) !== poundsToPence(sent.amount)) return false;
  if (!Array.isArray(item.invoices)) return false;
  const applied = new Map<string, number>();
  for (const raw of item.invoices) {
    const row = asRecord(raw);
    const id = row?.invoice_id;
    const amount = poundsToPence(row?.amount_applied);
    if (typeof id !== "string" || amount === null) return false;
    if (amount === 0) continue;
    applied.set(id, (applied.get(id) ?? 0) + amount);
  }
  const ours = new Map<string, number>();
  for (const row of sent.invoices) {
    const amount = poundsToPence(row.amount_applied) ?? Number.NaN;
    ours.set(row.invoice_id, (ours.get(row.invoice_id) ?? 0) + amount);
  }
  if (applied.size !== ours.size) return false;
  for (const [id, amount] of ours) if (applied.get(id) !== amount) return false;
  return true;
}

export class ZohoPaymentGateway implements PaymentPort {
  constructor(private readonly deps: GatewayDeps) {}

  async recordPayment(payment: Payment): Promise<IssueOutcome> {
    const ready = await prepare(this.deps, payment, [
      { kind: "contact", reference: payment.contactReference, contactType: "customer" },
      ...payment.allocations.map(
        (a): Dependency => ({ kind: "invoice", reference: a.invoiceReference }),
      ),
    ]);
    if ("stop" in ready) return ready.stop;
    const [customerId, ...invoiceIds] = ready.ids as [string, ...string[]];
    const byReference = new Map<string, string>();
    payment.allocations.forEach((a, i) => {
      const id = invoiceIds[i];
      if (id !== undefined) byReference.set(a.invoiceReference, id);
    });
    const built = mapped(paymentBody(payment, customerId, byReference, ready.org));
    if ("stop" in built) return built.stop;
    const sent = built.body;
    return this.deps.writer.create({
      org: ready.org,
      product: payment.product,
      kind: "payment",
      reference: payment.reference,
      body: sent,
      verify: (item) => (paymentMatches(sent, item) ? null : ZOHO_BOOKS_REJECTIONS.paymentMismatch),
    });
  }
}

export class ZohoBillGateway implements BillPort {
  constructor(private readonly deps: GatewayDeps) {}

  async issueBill(bill: Bill): Promise<IssueOutcome> {
    const ready = await prepare(this.deps, bill, [
      { kind: "contact", reference: bill.contactReference, contactType: "vendor" },
    ]);
    if ("stop" in ready) return ready.stop;
    const [vendorId] = ready.ids as [string];
    const built = mapped(billBody(bill, vendorId, ready.org));
    if ("stop" in built) return built.stop;
    return this.deps.writer.create({
      org: ready.org,
      product: bill.product,
      kind: "bill",
      reference: bill.reference,
      body: built.body,
    });
  }
}

/** Seller and artist payouts are billed to a vendor contact, kept apart from the customer one. */
export interface VendorPort {
  upsertVendor(contact: Contact): Promise<IssueOutcome>;
}

/**
 * Create the contact as a customer or vendor, or bring the existing one's name up to date. Found
 * by its reference value, so one legal-entity id is one Books contact of each type however often
 * this runs.
 */
class ContactUpsert {
  constructor(
    private readonly deps: GatewayDeps,
    private readonly api: ZohoApi,
    private readonly type: ContactType,
  ) {}

  async upsert(contact: Contact): Promise<IssueOutcome> {
    const ready = await prepare(this.deps, contact, []);
    if ("stop" in ready) return ready.stop;
    const { org } = ready;
    const storedValue = contactReferenceValue(contact.reference, this.type);
    const wrongType: Stop = {
      status: "rejected",
      reason:
        this.type === "vendor"
          ? ZOHO_BOOKS_REJECTIONS.contactNotVendor
          : ZOHO_BOOKS_REJECTIONS.contactNotCustomer,
    };
    const verify = (item: BooksRecord) =>
      item.contact_type === this.type ? null : wrongType.reason;
    const found = await this.deps.lookup.findIn(
      org,
      contact.product,
      "contact",
      contact.reference,
      storedValue,
    );
    switch (found.outcome.status) {
      case "not_found":
        return this.deps.writer.create({
          org,
          product: contact.product,
          kind: "contact",
          reference: contact.reference,
          storedValue,
          body: contactCreateBody(contact, this.type, org),
          verify,
        });
      case "found":
        if (!found.item || verify(found.item)) return wrongType;
        return this.update(org, found.outcome.providerId, contact);
      case "ambiguous":
        return { status: "rejected", reason: "zoho_books_contact_ambiguous" };
      case "unavailable":
        return { status: "unknown", detail: found.outcome.reason };
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

/** Customers: the people we invoice, credit and take payments from. */
export class ZohoContactGateway implements ContactPort {
  private readonly upsert: ContactUpsert;
  constructor(deps: GatewayDeps, api: ZohoApi) {
    this.upsert = new ContactUpsert(deps, api, "customer");
  }
  upsertContact(contact: Contact): Promise<IssueOutcome> {
    return this.upsert.upsert(contact);
  }
}

/** Vendors: the sellers and artists we bill payouts to. */
export class ZohoVendorGateway implements VendorPort {
  private readonly upsert: ContactUpsert;
  constructor(deps: GatewayDeps, api: ZohoApi) {
    this.upsert = new ContactUpsert(deps, api, "vendor");
  }
  upsertVendor(contact: Contact): Promise<IssueOutcome> {
    return this.upsert.upsert(contact);
  }
}
