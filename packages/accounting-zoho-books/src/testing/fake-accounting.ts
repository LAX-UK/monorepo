import {
  type AccountingDocument,
  type AmountBasis,
  type Bill,
  type BillPort,
  type Contact,
  type ContactPort,
  type CreditNote,
  type CreditNotePort,
  type CreditNoteRefund,
  type CreditNoteRefundOutcome,
  type CreditNoteRefundPort,
  type DestinationPort,
  type DocumentKind,
  type DocumentLookupPort,
  type DocumentPdfPort,
  type ExpensePort,
  type Invoice,
  type InvoicePort,
  type IssueOutcome,
  LEGAL_ENTITIES,
  type LegalEntity,
  type Line,
  type LookupOutcome,
  type Payment,
  type PaymentPort,
  type PaymentRemainderPort,
  type PdfOutcome,
  type Product,
  type ProviderDocument,
  type RemainderApplication,
  type RemainderOutcome,
  type TransferPort,
  type WriteFence,
  expectedTotals,
  legalEntityFor,
  parseLaxReference,
} from "@auction/accounting-domain";
import type { VendorPort } from "../adapter/gateways.js";
import type { AccountingPorts } from "../adapter/index.js";
import { booksLineVat } from "../adapter/mappers/common.js";
import { type ContactType, contactReferenceValue } from "../adapter/mappers/contact.js";
import { ZOHO_BOOKS_REJECTIONS as R } from "../adapter/rejections.js";
import { FaultQueue } from "./faults.js";
import { BID_ORG_ID, SHOP_ORG_ID } from "./org-fixtures.js";

/** The organisation each entity is held in, as in `testOrgConfigs()`. */
const ORG_IDS: Readonly<Record<LegalEntity, string>> = {
  london_art_exchange: SHOP_ORG_ID,
  london_auction_xchange: BID_ORG_ID,
};

const PREFIX: Record<DocumentKind, string> = {
  invoice: "INV",
  credit_note: "CN",
  payment: "PMT",
  bill: "BILL",
  contact: "CON",
  expense: "EXP",
  transfer: "TRF",
};

export interface InMemoryAccountingOptions {
  /**
   * Which entities have an organisation, and whether each is VAT registered. Default: London Art
   * Exchange not registered (as in Books), the Bid organisation registered (a test assumption, the
   * real answer is still open), matching `testOrgConfigs()`.
   */
  readonly orgs?: Readonly<Partial<Record<LegalEntity, { readonly vatRegistered: boolean }>>>;
}

interface Held {
  readonly doc: ProviderDocument;
  /** What makes a resend the same document, beyond its reference (a payment's allocations). */
  readonly fingerprint: string;
  readonly contactType?: ContactType;
  /** Held, but reads back different from what was sent (`read_back_differs`, `renumbered`). */
  readonly readBackDiffers?: boolean;
  /** Why it reads back different: a payment's fields, or an invoice Books numbered itself. */
  readonly differsReason?: string;
  /** A payment's amount not applied to any invoice when it was made. */
  readonly unappliedPence?: number;
}

type Stop = Extract<IssueOutcome, { status: "rejected" | "unknown" }>;
/** The adapter's reason for a write its fence refused (`ZohoFencedError`). */
const FENCED = "zoho_books_fenced_lease_lost";
const rejected = (reason: string): Stop => ({ status: "rejected", reason });

/**
 * The accounting ports held in memory, for tests of everything built on them. It follows the same
 * rules as the Books adapter: one organisation per legal entity, chosen from the product and
 * refused when the document's entity disagrees; dependencies looked for in that organisation only;
 * customers and vendors kept apart; VAT refused for an organisation that is not registered, and
 * refused where Books would work out a different VAT; one document per LAX reference (a repeat
 * returns the same identity, a payment repeat with other allocations `differs`). The reasons are
 * the adapter's own codes, so a test against the fake sees what it would see against Books.
 */
export class InMemoryAccounting implements AccountingPorts {
  readonly faults = new FaultQueue();
  private readonly held = new Map<string, Held>();
  private readonly counters = new Map<string, number>();
  /** Remainders applied after the fact, by payment key: invoice key -> pence. */
  private readonly remainderApplied = new Map<string, Map<string, number>>();
  private readonly orgs: Readonly<Partial<Record<LegalEntity, { vatRegistered: boolean }>>>;

  constructor(options: InMemoryAccountingOptions = {}) {
    this.orgs = options.orgs ?? {
      london_art_exchange: { vatRegistered: false },
      london_auction_xchange: { vatRegistered: true },
    };
  }

  readonly invoices: InvoicePort = {
    issueInvoice: (d: Invoice, fence?: WriteFence) =>
      this.issue(
        d,
        [["contact", d.contactReference, "customer"]],
        d.amountsAre === "tax_inclusive" ? "tax_inclusive" : "tax_exclusive",
        undefined,
        fence,
      ),
  };
  /**
   * As the adapter: the same checks as a document, then the payment read first, so a second run
   * is `already_applied`; a payment with too little left, or another amount already applied to
   * the invoice, is refused.
   */
  readonly remainders: PaymentRemainderPort = {
    applyRemainder: async (
      a: RemainderApplication,
      fence?: WriteFence,
    ): Promise<RemainderOutcome> => {
      const entity = legalEntityFor(a.product);
      if (a.entity !== entity) return rejected(R.entityMismatch);
      if (!this.orgs[entity]) return rejected(R.organisationNotConfigured);
      for (const need of [
        ["contact", a.contactReference, "customer"],
        ["payment", a.paymentReference],
        ["invoice", a.invoiceReference],
      ] as const satisfies readonly Need[]) {
        const stop = this.dependency(a.product, entity, need);
        if (stop) {
          return stop.status === "rejected"
            ? stop
            : { status: "unknown", ...(stop.detail ? { detail: stop.detail } : {}) };
        }
      }
      const paymentKey = this.key(entity, "payment", a.paymentReference);
      const payment = this.held.get(paymentKey);
      const applied = this.remainderApplied.get(paymentKey) ?? new Map<string, number>();
      const invoiceKey = this.key(entity, "invoice", a.invoiceReference);
      const already = applied.get(invoiceKey) ?? 0;
      if (already === a.amountPence) return { status: "already_applied", rehearsal: false };
      if (already !== 0) return rejected(R.remainderDiffers);
      const used = [...applied.values()].reduce((sum, p) => sum + p, 0);
      if ((payment?.unappliedPence ?? 0) - used < a.amountPence) {
        return rejected(R.remainderUnavailable);
      }
      if (fence && !(await fence.mayWrite())) return rejected(FENCED);
      applied.set(invoiceKey, a.amountPence);
      this.remainderApplied.set(paymentKey, applied);
      return { status: "applied", rehearsal: false };
    },
  };
  /** Refunds recorded on credit notes, by credit note key: amount and reference. */
  private readonly creditNoteRefunded = new Map<
    string,
    { amountPence: number; reference: string }
  >();
  /**
   * As the adapter: the same checks as a document, then the credit note's refunds read first, so a
   * second run is `already_refunded`; another refund already on it is refused, never topped up.
   */
  readonly creditNoteRefunds: CreditNoteRefundPort = {
    refundCreditNote: async (
      r: CreditNoteRefund,
      fence?: WriteFence,
    ): Promise<CreditNoteRefundOutcome> => {
      const entity = legalEntityFor(r.product);
      if (r.entity !== entity) return rejected(R.entityMismatch);
      if (!this.orgs[entity]) return rejected(R.organisationNotConfigured);
      if (r.account !== "stripe_clearing" || !(r.amountPence > 0)) {
        return rejected(R.creditNoteRefundDiffers);
      }
      for (const need of [
        ["contact", r.contactReference, "customer"],
        ["credit_note", r.creditNoteReference],
      ] as const satisfies readonly Need[]) {
        const stop = this.dependency(r.product, entity, need);
        if (stop) {
          return stop.status === "rejected"
            ? stop
            : { status: "unknown", ...(stop.detail ? { detail: stop.detail } : {}) };
        }
      }
      const key = this.key(entity, "credit_note", r.creditNoteReference);
      const already = this.creditNoteRefunded.get(key);
      if (already) {
        return already.amountPence === r.amountPence && already.reference === r.creditNoteReference
          ? { status: "already_refunded", rehearsal: false }
          : rejected(R.creditNoteRefundDiffers);
      }
      if (fence && !(await fence.mayWrite())) return rejected(FENCED);
      this.creditNoteRefunded.set(key, {
        amountPence: r.amountPence,
        reference: r.creditNoteReference,
      });
      return { status: "refunded", rehearsal: false };
    },
  };
  /** The refund recorded on a credit note held under a reference, for assertions. */
  creditNoteRefundOf(product: Product, creditNoteReference: string): number | null {
    const key = this.key(legalEntityFor(product), "credit_note", creditNoteReference);
    return this.creditNoteRefunded.get(key)?.amountPence ?? null;
  }
  /** What a payment held under a reference has had applied after the fact, for assertions. */
  remainderAppliedOf(product: Product, paymentReference: string): ReadonlyMap<string, number> {
    const key = this.key(legalEntityFor(product), "payment", paymentReference);
    return this.remainderApplied.get(key) ?? new Map();
  }
  readonly creditNotes: CreditNotePort = {
    issueCreditNote: (d: CreditNote, fence?: WriteFence) =>
      this.issue(
        d,
        [
          ["contact", d.contactReference, "customer"],
          ["invoice", d.invoiceReference],
        ],
        "tax_inclusive",
        undefined,
        fence,
      ),
  };
  readonly payments: PaymentPort = {
    recordPayment: (d: Payment, fence?: WriteFence) =>
      this.issue(
        d,
        [
          ["contact", d.contactReference, "customer"],
          ...d.allocations.map((a): Need => ["invoice", a.invoiceReference]),
        ],
        undefined,
        undefined,
        fence,
      ),
  };
  readonly bills: BillPort = {
    issueBill: (d: Bill, fence?: WriteFence) =>
      this.issue(d, [["contact", d.contactReference, "vendor"]], "tax_exclusive", undefined, fence),
  };
  /** Stripe's fees: no contact, no lines; one amount on one day, from the clearing account. */
  readonly expenses: ExpensePort = {
    recordExpense: (d, fence?: WriteFence) => this.issue(d, [], undefined, undefined, fence),
  };
  /** Stripe payouts: no contact, no lines; one amount on one day, clearing to the bank. */
  readonly transfers: TransferPort = {
    recordTransfer: (d, fence?: WriteFence) => this.issue(d, [], undefined, undefined, fence),
  };
  readonly contacts: ContactPort = {
    upsertContact: (d: Contact, fence?: WriteFence) =>
      this.issue(d, [], undefined, "customer", fence),
  };
  readonly vendors: VendorPort = {
    upsertVendor: (d: Contact, fence?: WriteFence) => this.issue(d, [], undefined, "vendor", fence),
  };
  readonly destination: DestinationPort = {
    destinationFor: (product) => {
      const entity = legalEntityFor(product);
      return this.orgs[entity]
        ? { kind: "organisation", organisationId: ORG_IDS[entity] }
        : { kind: "unconfigured", reason: R.organisationNotConfigured };
    },
  };
  /** Found by reference, then read back against the document as the adapter does (`differs`). */
  readonly lookup: DocumentLookupPort = {
    findDocument: async (document): Promise<LookupOutcome> => {
      const { product, kind, reference } = document;
      const entity = legalEntityFor(product);
      if (document.entity !== entity) return { status: "unavailable", reason: R.entityMismatch };
      if (!this.orgs[entity]) return { status: "unavailable", reason: R.organisationNotConfigured };
      const parsed = parseLaxReference(reference);
      if (!parsed.ok || parsed.value.product !== product || parsed.value.kind !== kind) {
        return { status: "unavailable", reason: "zoho_books_bad_reference" };
      }
      const fault = this.faults.takeLookup();
      if (fault === "lookup_unavailable")
        return { status: "unavailable", reason: "fake_unreadable" };
      if (fault === "lookup_ambiguous") return { status: "ambiguous", count: 2 };
      const found = this.held.get(this.key(entity, kind, reference, "customer"));
      if (!found) return { status: "not_found" };
      return this.differs(found, document)
        ? { status: "differs", reason: found.differsReason ?? R.paymentMismatch, ...found.doc }
        : { status: "found", ...found.doc };
    },
  };

  /**
   * The PDF Books would render for an invoice or credit note it holds, asked for by the identity
   * it gave. Anything else (not held, another kind, another id) is `unavailable`, as Books would be.
   */
  readonly pdfs: DocumentPdfPort = {
    fetchPdf: async (document, issued): Promise<PdfOutcome> => {
      const entity = legalEntityFor(document.product);
      const held = this.held.get(this.key(entity, document.kind, document.reference, "customer"));
      const printable = document.kind === "invoice" || document.kind === "credit_note";
      if (!printable || !held || held.doc.providerId !== issued.providerId) {
        return { status: "unavailable", reason: R.pdfNotAvailable };
      }
      const page = `%PDF-1.4\n% fake Books ${held.doc.number} ${document.reference}\n%%EOF\n`;
      return {
        status: "fetched",
        contentType: "application/pdf",
        rehearsal: false,
        bytes: new TextEncoder().encode(page),
      };
    },
  };

  /** Held under the reference, but not the document we would send (a payment's allocations). */
  private differs(held: Held, document: AccountingDocument): boolean {
    const fingerprint = fingerprintOf(document);
    return held.readBackDiffers === true || held.fingerprint !== fingerprint;
  }

  private key(entity: LegalEntity, kind: DocumentKind, reference: string, type?: ContactType) {
    const value = kind === "contact" && type ? contactReferenceValue(reference, type) : reference;
    return `${entity}:${kind}:${value}`;
  }

  /** A dependency's Books id, looked for in the document's own organisation only. */
  private dependency(product: Product, entity: LegalEntity, need: Need): Stop | null {
    const [kind, reference, type] = need;
    const parsed = parseLaxReference(reference);
    if (!parsed.ok || parsed.value.kind !== kind) return rejected("zoho_books_bad_reference");
    if (parsed.value.product !== product) return rejected(R.entityMismatch);
    const fault = this.faults.takeLookup();
    if (fault === "lookup_unavailable") return { status: "unknown", detail: "fake_unreadable" };
    if (fault === "lookup_ambiguous") return rejected(`zoho_books_${kind}_ambiguous`);
    // A person held only as the other type of contact is, for this document, not there at all.
    if (this.held.has(this.key(entity, kind, reference, type))) return null;
    return rejected(`zoho_books_${kind}_missing`);
  }

  private lines(lines: readonly Line[], basis: AmountBasis, vatRegistered: boolean): Stop | null {
    for (const line of lines) {
      if (line.basis !== basis) return rejected(R.mixedBasis);
      if (!vatRegistered) {
        if (line.vatPence > 0 || line.treatment === "standard") {
          return rejected(R.vatOnUnregisteredEntity);
        }
      } else if (booksLineVat(line) !== line.vatPence) {
        return rejected(R.vatDiffersFromBooks);
      }
    }
    return null;
  }

  private async issue(
    doc: AccountingDocument,
    needs: readonly Need[],
    basis?: AmountBasis,
    contactType?: ContactType,
    fence?: WriteFence,
  ): Promise<IssueOutcome> {
    const entity = legalEntityFor(doc.product);
    if (doc.entity !== entity || !LEGAL_ENTITIES.includes(doc.entity)) {
      return rejected(R.entityMismatch);
    }
    const org = this.orgs[entity];
    if (!org) return rejected(R.organisationNotConfigured);
    for (const need of needs) {
      const stop = this.dependency(doc.product, entity, need);
      if (stop) return stop;
    }
    if (basis && "lines" in doc) {
      const stop = this.lines(doc.lines, basis, org.vatRegistered);
      if (stop) return stop;
    }
    // As the adapter: the write is the last step, and a fenced one is never sent.
    if (fence && !(await fence.mayWrite())) return rejected(FENCED);
    const fault = this.faults.take();
    if (fault === "rate_limited") return rejected("fake_rate_limited");
    if (fault === "locked_period") return rejected("fake_period_locked");

    const key = this.key(entity, doc.kind, doc.reference, contactType);
    const fingerprint = fingerprintOf(doc);
    const existing = this.held.get(key);
    if (existing) {
      if (this.differs(existing, doc)) {
        return {
          status: "differs",
          reason: existing.differsReason ?? R.paymentMismatch,
          ...existing.doc,
        };
      }
      return { status: "issued", ...existing.doc };
    }

    // An invoice LAX numbered keeps that number (automatic numbering is off for it), and Books
    // refuses a number it already holds rather than renumbering.
    const laxNumber = doc.kind === "invoice" ? doc.number : undefined;
    const sameOrgInvoices = [...this.held].filter(([k]) => k.startsWith(`${entity}:invoice:`));
    if (laxNumber && sameOrgInvoices.some(([, h]) => h.doc.number === laxNumber)) {
      return rejected("zoho_books_validation_duplicate_invoice_number");
    }
    const seq = (this.counters.get(`${entity}:${doc.kind}`) ?? 0) + 1;
    this.counters.set(`${entity}:${doc.kind}`, seq);
    const mine = expectedTotals(doc);
    const drift = fault === "totals_drift" && doc.kind !== "contact" ? 1 : 0;
    // Books renumbering an invoice LAX numbered (an organisation setting): made, but not ours.
    const renumbered = fault === "renumbered" && laxNumber !== undefined;
    const provider: ProviderDocument = {
      number:
        laxNumber !== undefined && !renumbered
          ? laxNumber
          : `${PREFIX[doc.kind]}-${String(seq).padStart(6, "0")}`,
      providerId: String(7_000_000_000_000 + this.held.size + 1),
      pdfRef:
        doc.kind === "invoice" || doc.kind === "credit_note"
          ? `/${doc.kind === "invoice" ? "invoices" : "creditnotes"}/${7_000_000_000_000 + this.held.size + 1}`
          : null,
      totals: {
        netPence: mine.netPence,
        vatPence: mine.vatPence + drift,
        grossPence: mine.grossPence + drift,
      },
    };
    const paymentDiffers = fault === "read_back_differs" && doc.kind === "payment";
    const readBackDiffers = paymentDiffers || renumbered;
    const differsReason = renumbered ? R.numberDiffers : R.paymentMismatch;
    this.held.set(key, {
      doc: provider,
      fingerprint,
      ...(doc.kind === "payment" ? { unappliedPence: doc.unallocatedPence } : {}),
      ...(contactType ? { contactType } : {}),
      ...(readBackDiffers ? { readBackDiffers, differsReason } : {}),
    });
    if (fault === "timeout_after_commit") return { status: "unknown", detail: "fake_timeout" };
    if (readBackDiffers) return { status: "differs", reason: differsReason, ...provider };
    return { status: "issued", ...provider };
  }
}

type Need = readonly [kind: DocumentKind, reference: string, type?: ContactType];

function paymentFingerprint(p: Payment): string {
  const allocations = [...p.allocations]
    .map((a) => `${a.invoiceReference}=${a.amountPence}`)
    .sort()
    .join(",");
  return `${p.contactReference}|${p.receivedOn}|${p.currency}|${p.amountPence}|${allocations}`;
}

/**
 * What makes a resend the same document beyond its reference: a payment's allocations; an
 * expense's or transfer's amount and day (Books holds both on the record, and the adapter reads
 * them back). Nothing for the rest (their totals are compared by the domain).
 */
function fingerprintOf(document: AccountingDocument): string {
  switch (document.kind) {
    case "payment":
      return paymentFingerprint(document);
    case "expense":
      return `${document.amountPence}:${document.spentOn}`;
    case "transfer":
      return `${document.amountPence}:${document.transferredOn}`;
    default:
      return "";
  }
}
