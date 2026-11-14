import type {
  Bill,
  BillPort,
  Contact,
  ContactPort,
  CreditNote,
  CreditNotePort,
  Expense,
  ExpensePort,
  Invoice,
  InvoicePort,
  IssueOutcome,
  Payment,
  PaymentPort,
  Product,
  Result,
  Transfer,
  TransferPort,
  WriteFence,
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
import { invoiceBody, invoiceQuery } from "./mappers/invoice.js";
import {
  type ExpenseBody,
  type TransferBody,
  expenseBody,
  transferBody,
} from "./mappers/movement.js";
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
type Resolved = { readonly ids: readonly string[] } | { stop: Stop };

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
  const resolved = await resolveAll(deps.lookup, org, doc.product, dependencies);
  return "stop" in resolved ? resolved : { org, ids: resolved.ids };
}

/** `prepare`, for a step that is not a document of its own (applying a payment's remainder). */
export function prepareFor(
  deps: GatewayDeps,
  doc: { readonly product: Product; readonly entity: Contact["entity"] },
  dependencies: readonly Dependency[],
): Promise<Prepared> {
  return prepare(deps, doc, dependencies);
}

/** Refuse dependencies of another product, then find each one's Books id in `org`, in order. */
async function resolveAll(
  lookup: ZohoDocumentLookup,
  org: ZohoOrgConfig,
  product: Product,
  dependencies: readonly Dependency[],
): Promise<Resolved> {
  const foreign = sameProduct(product, dependencies);
  if (foreign) return { stop: foreign };
  const ids: string[] = [];
  for (const dependency of dependencies) {
    const resolved = await resolveProviderId(lookup, org, product, dependency);
    if (resolved.status === "stop") return { stop: resolved.outcome };
    ids.push(resolved.id);
  }
  return { ids };
}

/** Says why the document Books holds is not the one we sent, or null when it is. */
export type ReadBackCheck = (item: BooksRecord) => string | null;

/**
 * How to check, for one document, that what Books holds under its reference is the one we would
 * send: a check (null when its totals are all there is to compare), or why it cannot be worked out.
 * Built with lookups only, so a lookup can run it in any write mode.
 */
export type ReadBack = { readonly check: ReadBackCheck | null } | { readonly stop: Stop };

/**
 * An invoice LAX numbered is ours only under that number: Books must not have renumbered it (an
 * organisation setting can make it). Null (totals only) for an invoice Books numbers itself.
 */
export function invoiceNumberCheck(invoice: Invoice): ReadBackCheck | null {
  const number = invoice.number;
  if (!number) return null;
  return (item) => (item.invoice_number === number ? null : ZOHO_BOOKS_REJECTIONS.numberDiffers);
}

export class ZohoInvoiceGateway implements InvoicePort {
  constructor(private readonly deps: GatewayDeps) {}

  async issueInvoice(invoice: Invoice, fence?: WriteFence): Promise<IssueOutcome> {
    const ready = await prepare(this.deps, invoice, [
      { kind: "contact", reference: invoice.contactReference, contactType: "customer" },
    ]);
    if ("stop" in ready) return ready.stop;
    const [customerId] = ready.ids as [string];
    const built = mapped(invoiceBody(invoice, customerId, ready.org));
    if ("stop" in built) return built.stop;
    const query = invoiceQuery(invoice);
    const verify = invoiceNumberCheck(invoice);
    return this.deps.writer.create({
      org: ready.org,
      product: invoice.product,
      kind: "invoice",
      reference: invoice.reference,
      ...(fence ? { fence } : {}),
      body: built.body,
      ...(query ? { query } : {}),
      ...(verify ? { verify } : {}),
    });
  }
}

export class ZohoCreditNoteGateway implements CreditNotePort {
  constructor(private readonly deps: GatewayDeps) {}

  async issueCreditNote(creditNote: CreditNote, fence?: WriteFence): Promise<IssueOutcome> {
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
      ...(fence ? { fence } : {}),
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

function paymentDependencies(payment: Payment): readonly Dependency[] {
  return [
    { kind: "contact", reference: payment.contactReference, contactType: "customer" },
    ...payment.allocations.map(
      (a): Dependency => ({ kind: "invoice", reference: a.invoiceReference }),
    ),
  ];
}

/** The payment body for Books, from the customer and invoice ids resolved in its organisation. */
function buildPaymentBody(
  payment: Payment,
  ids: readonly string[],
  org: ZohoOrgConfig,
): { body: PaymentBody } | { stop: Stop } {
  const [customerId, ...invoiceIds] = ids as [string, ...string[]];
  const byReference = new Map<string, string>();
  payment.allocations.forEach((a, i) => {
    const id = invoiceIds[i];
    if (id !== undefined) byReference.set(a.invoiceReference, id);
  });
  return mapped(paymentBody(payment, customerId, byReference, org));
}

function paymentCheck(sent: PaymentBody): ReadBackCheck {
  return (item) => (paymentMatches(sent, item) ? null : ZOHO_BOOKS_REJECTIONS.paymentMismatch);
}

/** A payment is read back field by field against the body we would send to `org`. */
export async function paymentReadBack(
  lookup: ZohoDocumentLookup,
  payment: Payment,
  org: ZohoOrgConfig,
): Promise<ReadBack> {
  const resolved = await resolveAll(lookup, org, payment.product, paymentDependencies(payment));
  if ("stop" in resolved) return resolved;
  const built = buildPaymentBody(payment, resolved.ids, org);
  return "stop" in built ? built : { check: paymentCheck(built.body) };
}

export class ZohoPaymentGateway implements PaymentPort {
  constructor(private readonly deps: GatewayDeps) {}

  async recordPayment(payment: Payment, fence?: WriteFence): Promise<IssueOutcome> {
    const ready = await prepare(this.deps, payment, paymentDependencies(payment));
    if ("stop" in ready) return ready.stop;
    const built = buildPaymentBody(payment, ready.ids, ready.org);
    if ("stop" in built) return built.stop;
    return this.deps.writer.create({
      org: ready.org,
      product: payment.product,
      kind: "payment",
      reference: payment.reference,
      ...(fence ? { fence } : {}),
      body: built.body,
      verify: paymentCheck(built.body),
    });
  }
}

export class ZohoBillGateway implements BillPort {
  constructor(private readonly deps: GatewayDeps) {}

  async issueBill(bill: Bill, fence?: WriteFence): Promise<IssueOutcome> {
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
      ...(fence ? { fence } : {}),
      body: built.body,
    });
  }
}

/**
 * An expense or transfer Books holds is ours only if it moves the same amount on the same day
 * between the same accounts. Its amount alone is not enough.
 */
export function movementCheck(sent: ExpenseBody | TransferBody): ReadBackCheck {
  const fields: readonly string[] =
    "transaction_type" in sent
      ? ["from_account_id", "to_account_id", "date", "currency_code"]
      : ["account_id", "paid_through_account_id", "date", "currency_code"];
  const amountField = "transaction_type" in sent ? "amount" : "total";
  const ours = sent as unknown as Readonly<Record<string, unknown>>;
  return (item) =>
    fields.every((f) => item[f] === ours[f]) &&
    poundsToPence(item[amountField]) === poundsToPence(sent.amount)
      ? null
      : ZOHO_BOOKS_REJECTIONS.movementMismatch;
}

/** The body an expense or transfer would be sent with to `org`, for a read-back. */
export function movementReadBack(
  document: Expense | Transfer,
  org: ZohoOrgConfig,
): { readonly check: ReadBackCheck } | { readonly stop: Stop } {
  const built = mapped<ExpenseBody | TransferBody>(
    document.kind === "expense" ? expenseBody(document, org) : transferBody(document, org),
  );
  return "stop" in built ? built : { check: movementCheck(built.body) };
}

/** Stripe's fees: an expense paid through the Stripe clearing account. No contact. */
export class ZohoExpenseGateway implements ExpensePort {
  constructor(private readonly deps: GatewayDeps) {}

  async recordExpense(expense: Expense, fence?: WriteFence): Promise<IssueOutcome> {
    const ready = await prepare(this.deps, expense, []);
    if ("stop" in ready) return ready.stop;
    const built = mapped(expenseBody(expense, ready.org));
    if ("stop" in built) return built.stop;
    return this.deps.writer.create({
      org: ready.org,
      product: expense.product,
      kind: "expense",
      reference: expense.reference,
      ...(fence ? { fence } : {}),
      body: built.body,
      verify: movementCheck(built.body),
    });
  }
}

/** Stripe payouts: a transfer from the Stripe clearing account to the bank account. */
export class ZohoTransferGateway implements TransferPort {
  constructor(private readonly deps: GatewayDeps) {}

  async recordTransfer(transfer: Transfer, fence?: WriteFence): Promise<IssueOutcome> {
    const ready = await prepare(this.deps, transfer, []);
    if ("stop" in ready) return ready.stop;
    const built = mapped(transferBody(transfer, ready.org));
    if ("stop" in built) return built.stop;
    return this.deps.writer.create({
      org: ready.org,
      product: transfer.product,
      kind: "transfer",
      reference: transfer.reference,
      ...(fence ? { fence } : {}),
      body: built.body,
      verify: movementCheck(built.body),
    });
  }
}

/** Seller and artist payouts are billed to a vendor contact, kept apart from the customer one. */
export interface VendorPort {
  upsertVendor(contact: Contact, fence?: WriteFence): Promise<IssueOutcome>;
}

/** A contact is ours only as the type we keep it as: a customer is never a vendor, or the reverse. */
export function contactTypeCheck(type: ContactType): ReadBackCheck {
  const wrongType =
    type === "vendor"
      ? ZOHO_BOOKS_REJECTIONS.contactNotVendor
      : ZOHO_BOOKS_REJECTIONS.contactNotCustomer;
  return (item) => (item.contact_type === type ? null : wrongType);
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

  async upsert(contact: Contact, fence?: WriteFence): Promise<IssueOutcome> {
    const ready = await prepare(this.deps, contact, []);
    if ("stop" in ready) return ready.stop;
    const { org } = ready;
    const storedValue = contactReferenceValue(contact.reference, this.type);
    const verify = contactTypeCheck(this.type);
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
          ...(fence ? { fence } : {}),
        });
      case "found": {
        const wrongType = verify(found.item ?? {});
        if (wrongType) return { status: "rejected", reason: wrongType };
        return this.update(org, found.outcome.providerId, contact, fence);
      }
      case "ambiguous":
        return { status: "rejected", reason: "zoho_books_contact_ambiguous" };
      case "unavailable":
        return { status: "unknown", detail: found.outcome.reason };
    }
  }

  private async update(
    org: ZohoOrgConfig,
    id: string,
    contact: Contact,
    fence: WriteFence | undefined,
  ): Promise<IssueOutcome> {
    const spec = KIND_SPECS.contact;
    const reply = await this.api.put(
      org.organizationId,
      `${spec.path}/${id}`,
      contactUpdateBody(contact),
      undefined,
      fence ? { fence } : undefined,
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
  upsertContact(contact: Contact, fence?: WriteFence): Promise<IssueOutcome> {
    return this.upsert.upsert(contact, fence);
  }
}

/** Vendors: the sellers and artists we bill payouts to. */
export class ZohoVendorGateway implements VendorPort {
  private readonly upsert: ContactUpsert;
  constructor(deps: GatewayDeps, api: ZohoApi) {
    this.upsert = new ContactUpsert(deps, api, "vendor");
  }
  upsertVendor(contact: Contact, fence?: WriteFence): Promise<IssueOutcome> {
    return this.upsert.upsert(contact, fence);
  }
}
