import {
  type Invoice,
  type IssueOutcome,
  type LineInput,
  type Product,
  type Result,
  buildBill,
  buildContact,
  buildCreditNoteFor,
  buildInvoice,
  buildPayment,
  compareWithProviderTotals,
  expectedTotals,
} from "@auction/accounting-domain";
import type { AccountingPorts } from "../adapter/index.js";
import type { TestApi } from "./contract.js";
import type { FaultInjector } from "./faults.js";

/** What the contract needs from an implementation of the accounting ports. */
export interface AccountingSubject {
  readonly ports: AccountingPorts;
  readonly faults: FaultInjector;
  /** Waits for a call to finish (an adapter that backs off needs its clock run forward). */
  settle<T>(call: Promise<T>): Promise<T>;
}

function must<T>(result: Result<T, string>): T {
  if (!result.ok) throw new Error(`fixture refused: ${result.refusal.code}`);
  return result.value;
}

const GOODS: LineInput = {
  description: "Print, edition 1/50",
  quantity: 1,
  unitNetPence: 10_000,
  treatment: "standard",
  role: "goods",
};
const DELIVERY: LineInput = {
  description: "Delivery",
  quantity: 1,
  unitNetPence: 1_500,
  treatment: "standard",
  role: "delivery",
};
const MARGIN: LineInput = {
  description: "Original work",
  quantity: 1,
  unitNetPence: 250_000,
  treatment: "margin_scheme",
  role: "goods",
};
const ZERO: LineInput = {
  description: "Book",
  quantity: 2,
  unitNetPence: 1_999,
  treatment: "zero",
  role: "goods",
};

const SHOP: Product = "shop";
const BID: Product = "bid";

function contact(product: Product, sourceId = "buyer-1", name = "Test Buyer") {
  return must(buildContact({ product, sourceId, name, email: "buyer@example.test" }));
}

function invoice(product: Product, sourceId: string, lines: LineInput[], contactId = "buyer-1") {
  return must(
    buildInvoice({
      product,
      sourceId,
      contactReference: contact(product, contactId).reference,
      issuedOn: "2026-11-12",
      dueOn: "2026-11-26",
      lines,
    }),
  );
}

function issuedOf(outcome: IssueOutcome) {
  if (outcome.status !== "issued") throw new Error(`expected issued, got ${outcome.status}`);
  return outcome;
}

/**
 * One suite, run against every implementation of the accounting ports: the in-memory fake and the
 * Books adapter. If both pass, code written against the fake behaves the same against Books.
 */
export function runAccountingContract(
  api: TestApi,
  makeSubject: () => AccountingSubject | Promise<AccountingSubject>,
): void {
  const { describe, it, expect } = api;

  /** A subject that already holds the buyer's contact. */
  async function withContact(product: Product = SHOP) {
    const s = await makeSubject();
    const c = contact(product);
    issuedOf(await s.settle(s.ports.contacts.upsertContact(c)));
    return s;
  }

  describe("accounting ports contract", () => {
    describe("contacts", () => {
      it("creates a contact once and returns the same identity for the same reference", async () => {
        const s = await makeSubject();
        const first = issuedOf(await s.settle(s.ports.contacts.upsertContact(contact(SHOP))));
        const again = issuedOf(
          await s.settle(s.ports.contacts.upsertContact(contact(SHOP, "buyer-1", "Renamed Buyer"))),
        );
        expect(again.providerId).toBe(first.providerId);
        expect(first.totals).toEqual({ netPence: 0, vatPence: 0, grossPence: 0 });
      });

      it("keeps two contacts apart", async () => {
        const s = await makeSubject();
        const a = issuedOf(await s.settle(s.ports.contacts.upsertContact(contact(SHOP, "a"))));
        const b = issuedOf(await s.settle(s.ports.contacts.upsertContact(contact(SHOP, "b"))));
        expect(a.providerId === b.providerId).toBe(false);
      });
    });

    describe("invoices", () => {
      it("issues an invoice whose totals equal ours exactly", async () => {
        const s = await withContact();
        const doc = invoice(SHOP, "inv-1", [GOODS, DELIVERY]);
        const out = issuedOf(await s.settle(s.ports.invoices.issueInvoice(doc)));
        expect(compareWithProviderTotals(doc.totals, out.totals)).toEqual({ matches: true });
        expect(out.number === "").toBe(false);
      });

      it("handles zero rated, margin scheme and multi-quantity lines", async () => {
        const s = await withContact();
        const doc = invoice(SHOP, "inv-mixed", [MARGIN, ZERO, GOODS]);
        const out = issuedOf(await s.settle(s.ports.invoices.issueInvoice(doc)));
        expect(out.totals).toEqual(doc.totals);
      });

      it("never makes a second invoice for the same reference", async () => {
        const s = await withContact();
        const doc = invoice(SHOP, "inv-dup", [GOODS]);
        const first = issuedOf(await s.settle(s.ports.invoices.issueInvoice(doc)));
        const again = issuedOf(await s.settle(s.ports.invoices.issueInvoice(doc)));
        expect(again.providerId).toBe(first.providerId);
        expect(again.number).toBe(first.number);
      });

      it("refuses an invoice for a contact that does not exist", async () => {
        const s = await makeSubject();
        const out = await s.settle(
          s.ports.invoices.issueInvoice(invoice(SHOP, "inv-orphan", [GOODS])),
        );
        expect(out.status).toBe("rejected");
      });

      it("finds an issued invoice by reference with the same identity and totals", async () => {
        const s = await withContact();
        const doc = invoice(SHOP, "inv-find", [GOODS]);
        const out = issuedOf(await s.settle(s.ports.invoices.issueInvoice(doc)));
        const found = await s.settle(
          s.ports.lookup.findByReference(SHOP, "invoice", doc.reference),
        );
        expect(found.status).toBe("found");
        if (found.status !== "found") return;
        expect(found.providerId).toBe(out.providerId);
        expect(found.number).toBe(out.number);
        expect(found.totals).toEqual(out.totals);
      });

      it("reports not_found for a reference nothing was issued for", async () => {
        const s = await withContact();
        const ref = invoice(SHOP, "inv-never", [GOODS]).reference;
        const found = await s.settle(s.ports.lookup.findByReference(SHOP, "invoice", ref));
        expect(found.status).toBe("not_found");
      });

      it("keeps the two legal entities' books apart", async () => {
        const s = await makeSubject();
        issuedOf(await s.settle(s.ports.contacts.upsertContact(contact(BID))));
        issuedOf(await s.settle(s.ports.contacts.upsertContact(contact(SHOP))));
        issuedOf(await s.settle(s.ports.invoices.issueInvoice(invoice(BID, "same-id", [GOODS]))));
        const shopRef = invoice(SHOP, "same-id", [GOODS]).reference;
        const found = await s.settle(s.ports.lookup.findByReference(SHOP, "invoice", shopRef));
        expect(found.status).toBe("not_found");
      });
    });

    describe("payments", () => {
      it("records a payment across several invoices, the rest left unallocated", async () => {
        const s = await withContact();
        const a = invoice(SHOP, "pay-a", [GOODS]);
        const b = invoice(SHOP, "pay-b", [GOODS, DELIVERY]);
        issuedOf(await s.settle(s.ports.invoices.issueInvoice(a)));
        issuedOf(await s.settle(s.ports.invoices.issueInvoice(b)));
        const payment = must(
          buildPayment({
            product: SHOP,
            sourceId: "pay-1",
            contactReference: a.contactReference,
            receivedOn: "2026-11-12",
            amountPence: 40_000,
            allocations: [
              { invoiceReference: a.reference, amountPence: a.totals.grossPence },
              { invoiceReference: b.reference, amountPence: b.totals.grossPence },
            ],
          }),
        );
        const out = issuedOf(await s.settle(s.ports.payments.recordPayment(payment)));
        expect(out.totals).toEqual(expectedTotals(payment));
      });

      it("refuses a payment against an invoice that does not exist", async () => {
        const s = await withContact();
        const ghost = invoice(SHOP, "ghost", [GOODS]);
        const payment = must(
          buildPayment({
            product: SHOP,
            sourceId: "pay-ghost",
            contactReference: ghost.contactReference,
            receivedOn: "2026-11-12",
            amountPence: 1_000,
            allocations: [{ invoiceReference: ghost.reference, amountPence: 1_000 }],
          }),
        );
        expect((await s.settle(s.ports.payments.recordPayment(payment))).status).toBe("rejected");
      });
    });

    describe("credit notes", () => {
      function credited(source: Invoice) {
        return must(
          buildCreditNoteFor(source, {
            sourceId: "cn-1",
            issuedOn: "2026-11-13",
            buckets: {
              paidGoodsPence: 12_000,
              paidDeliveryPence: 1_800,
              refundedGoodsPence: 0,
              refundedDeliveryPence: 0,
            },
            request: { goodsPence: 6_000, deliveryPence: 0 },
            priorCredits: [],
          }),
        );
      }

      it("issues a partial credit note on an issued invoice with matching totals", async () => {
        const s = await withContact();
        const inv = invoice(SHOP, "cn-inv", [GOODS, DELIVERY]);
        issuedOf(await s.settle(s.ports.invoices.issueInvoice(inv)));
        const note = credited(inv);
        const out = issuedOf(await s.settle(s.ports.creditNotes.issueCreditNote(note)));
        expect(compareWithProviderTotals(note.totals, out.totals)).toEqual({ matches: true });
      });

      it("refuses a credit note for an invoice that was never issued", async () => {
        const s = await withContact();
        const inv = invoice(SHOP, "cn-missing", [GOODS, DELIVERY]);
        const note = credited(inv);
        expect((await s.settle(s.ports.creditNotes.issueCreditNote(note))).status).toBe("rejected");
      });
    });

    describe("bills", () => {
      it("issues a bill to a contact", async () => {
        const s = await withContact();
        const bill = must(
          buildBill({
            product: SHOP,
            sourceId: "bill-1",
            contactReference: contact(SHOP).reference,
            issuedOn: "2026-11-12",
            dueOn: "2026-11-19",
            lines: [{ ...GOODS, description: "Artist payout" }],
          }),
        );
        const out = issuedOf(await s.settle(s.ports.bills.issueBill(bill)));
        expect(out.totals).toEqual(bill.totals);
      });
    });

    describe("faults", () => {
      it("a lost answer is unknown, the document can be found, and a resend is the same document", async () => {
        const s = await withContact();
        const doc = invoice(SHOP, "inv-lost", [GOODS]);
        s.faults.inject("timeout_after_commit");
        const lost = await s.settle(s.ports.invoices.issueInvoice(doc));
        expect(lost.status).toBe("unknown");
        const found = await s.settle(
          s.ports.lookup.findByReference(SHOP, "invoice", doc.reference),
        );
        expect(found.status).toBe("found");
        const resent = issuedOf(await s.settle(s.ports.invoices.issueInvoice(doc)));
        if (found.status === "found") expect(resent.providerId).toBe(found.providerId);
      });

      it("a rate limit is a clean rejection and nothing is created", async () => {
        const s = await withContact();
        const doc = invoice(SHOP, "inv-limited", [GOODS]);
        s.faults.inject("rate_limited");
        expect((await s.settle(s.ports.invoices.issueInvoice(doc))).status).toBe("rejected");
        s.faults.clear();
        const found = await s.settle(
          s.ports.lookup.findByReference(SHOP, "invoice", doc.reference),
        );
        expect(found.status).toBe("not_found");
      });

      it("a locked period is a clean rejection and nothing is created", async () => {
        const s = await withContact();
        const doc = invoice(SHOP, "inv-locked", [GOODS]);
        s.faults.inject("locked_period");
        expect((await s.settle(s.ports.invoices.issueInvoice(doc))).status).toBe("rejected");
        const found = await s.settle(
          s.ports.lookup.findByReference(SHOP, "invoice", doc.reference),
        );
        expect(found.status).toBe("not_found");
      });

      it("a total that is a penny off is reported as it is, never adjusted away", async () => {
        const s = await withContact();
        const doc = invoice(SHOP, "inv-drift", [GOODS]);
        s.faults.inject("totals_drift");
        const out = issuedOf(await s.settle(s.ports.invoices.issueInvoice(doc)));
        const match = compareWithProviderTotals(doc.totals, out.totals);
        expect(match.matches).toBe(false);
        expect(out.totals.grossPence).toBe(doc.totals.grossPence + 1);
      });
    });
  });
}
