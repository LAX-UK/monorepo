import {
  type AccountingDocument,
  type AmountBasis,
  type Bill,
  type BillPort,
  type Contact,
  type ContactPort,
  type CreditNote,
  type CreditNotePort,
  type DocumentKind,
  type DocumentLookupPort,
  type Invoice,
  type InvoicePort,
  type IssueOutcome,
  LEGAL_ENTITIES,
  type LegalEntity,
  type Line,
  type LookupOutcome,
  type Payment,
  type PaymentPort,
  type Product,
  type ProviderDocument,
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

const PREFIX: Record<DocumentKind, string> = {
  invoice: "INV",
  credit_note: "CN",
  payment: "PMT",
  bill: "BILL",
  contact: "CON",
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
}

type Stop = Extract<IssueOutcome, { status: "rejected" | "unknown" }>;
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
  private readonly orgs: Readonly<Partial<Record<LegalEntity, { vatRegistered: boolean }>>>;

  constructor(options: InMemoryAccountingOptions = {}) {
    this.orgs = options.orgs ?? {
      london_art_exchange: { vatRegistered: false },
      london_auction_xchange: { vatRegistered: true },
    };
  }

  readonly invoices: InvoicePort = {
    issueInvoice: (d: Invoice) =>
      this.issue(d, [["contact", d.contactReference, "customer"]], "tax_exclusive"),
  };
  readonly creditNotes: CreditNotePort = {
    issueCreditNote: (d: CreditNote) =>
      this.issue(
        d,
        [
          ["contact", d.contactReference, "customer"],
          ["invoice", d.invoiceReference],
        ],
        "tax_inclusive",
      ),
  };
  readonly payments: PaymentPort = {
    recordPayment: (d: Payment) =>
      this.issue(d, [
        ["contact", d.contactReference, "customer"],
        ...d.allocations.map((a): Need => ["invoice", a.invoiceReference]),
      ]),
  };
  readonly bills: BillPort = {
    issueBill: (d: Bill) =>
      this.issue(d, [["contact", d.contactReference, "vendor"]], "tax_exclusive"),
  };
  readonly contacts: ContactPort = {
    upsertContact: (d: Contact) => this.issue(d, [], undefined, "customer"),
  };
  readonly vendors: VendorPort = {
    upsertVendor: (d: Contact) => this.issue(d, [], undefined, "vendor"),
  };
  readonly lookup: DocumentLookupPort = {
    findByReference: async (product, kind, reference): Promise<LookupOutcome> => {
      const entity = legalEntityFor(product);
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
      return found ? { status: "found", ...found.doc } : { status: "not_found" };
    },
  };

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
    const fault = this.faults.take();
    if (fault === "rate_limited") return rejected("fake_rate_limited");
    if (fault === "locked_period") return rejected("fake_locked_period");

    const key = this.key(entity, doc.kind, doc.reference, contactType);
    const fingerprint = doc.kind === "payment" ? paymentFingerprint(doc) : "";
    const existing = this.held.get(key);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        return { status: "differs", reason: R.paymentMismatch, ...existing.doc };
      }
      return { status: "issued", ...existing.doc };
    }

    const seq = (this.counters.get(`${entity}:${doc.kind}`) ?? 0) + 1;
    this.counters.set(`${entity}:${doc.kind}`, seq);
    const mine = expectedTotals(doc);
    const drift = fault === "totals_drift" && doc.kind !== "contact" ? 1 : 0;
    const provider: ProviderDocument = {
      number: `${PREFIX[doc.kind]}-${String(seq).padStart(6, "0")}`,
      providerId: String(7_000_000_000_000 + this.held.size + 1),
      pdfRef: null,
      totals: {
        netPence: mine.netPence,
        vatPence: mine.vatPence + drift,
        grossPence: mine.grossPence + drift,
      },
    };
    this.held.set(key, { doc: provider, fingerprint, ...(contactType ? { contactType } : {}) });
    if (fault === "timeout_after_commit") return { status: "unknown", detail: "fake_timeout" };
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
