import {
  type AccountingDocument,
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
  type LegalEntity,
  type LookupOutcome,
  type Payment,
  type PaymentPort,
  type ProviderDocument,
  expectedTotals,
  legalEntityFor,
} from "@auction/accounting-domain";
import type { AccountingPorts } from "../adapter/index.js";
import { FaultQueue } from "./faults.js";

const PREFIX: Record<DocumentKind, string> = {
  invoice: "INV",
  credit_note: "CN",
  payment: "PMT",
  bill: "BILL",
  contact: "CON",
};

/**
 * The accounting ports held in memory, for tests of everything built on them. It follows the same
 * rules as the Books adapter: one document per LAX reference (a repeat returns the same identity),
 * one organisation per legal entity, a document refused if what it refers to does not exist yet,
 * and the faults the contract injects. Totals are ours, unless `totals_drift` says otherwise.
 */
export class InMemoryAccounting implements AccountingPorts {
  readonly faults = new FaultQueue();
  private readonly held = new Map<string, ProviderDocument>();
  private readonly counters = new Map<string, number>();

  readonly invoices: InvoicePort = {
    issueInvoice: (d: Invoice) => this.issue(d, [d.contactReference]),
  };
  readonly creditNotes: CreditNotePort = {
    issueCreditNote: (d: CreditNote) => this.issue(d, [d.contactReference, d.invoiceReference]),
  };
  readonly payments: PaymentPort = {
    recordPayment: (d: Payment) =>
      this.issue(d, [d.contactReference, ...d.allocations.map((a) => a.invoiceReference)]),
  };
  readonly bills: BillPort = { issueBill: (d: Bill) => this.issue(d, [d.contactReference]) };
  readonly contacts: ContactPort = { upsertContact: (d: Contact) => this.issue(d, []) };
  readonly lookup: DocumentLookupPort = {
    findByReference: async (product, kind, reference): Promise<LookupOutcome> => {
      void kind;
      const found = this.held.get(this.key(legalEntityFor(product), reference));
      return found ? { status: "found", ...found } : { status: "not_found" };
    },
  };

  private key(entity: LegalEntity, reference: string): string {
    return `${entity}:${reference}`;
  }

  private async issue(doc: AccountingDocument, needs: readonly string[]): Promise<IssueOutcome> {
    const fault = this.faults.take();
    if (fault === "rate_limited") return { status: "rejected", reason: "fake_rate_limited" };
    if (fault === "locked_period") return { status: "rejected", reason: "fake_locked_period" };
    for (const reference of needs) {
      if (!this.held.has(this.key(doc.entity, reference))) {
        return { status: "rejected", reason: "fake_dependency_missing" };
      }
    }
    const key = this.key(doc.entity, doc.reference);
    const existing = this.held.get(key);
    if (existing) return { status: "issued", ...existing };

    const seq = (this.counters.get(`${doc.entity}:${doc.kind}`) ?? 0) + 1;
    this.counters.set(`${doc.entity}:${doc.kind}`, seq);
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
    this.held.set(key, provider);
    if (fault === "timeout_after_commit") return { status: "unknown", detail: "fake_timeout" };
    return { status: "issued", ...provider };
  }
}
