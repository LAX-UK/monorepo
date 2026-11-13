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
import { ZOHO_BOOKS_REJECTIONS as R } from "../adapter/rejections.js";
import type { TestApi } from "./contract.js";
import type { FaultInjector } from "./faults.js";
import { BID_ORG_ID, SHOP_ORG_ID } from "./org-fixtures.js";

/** What the contract needs from an implementation of the accounting ports. */
export interface AccountingSubject {
  readonly ports: AccountingPorts;
  readonly faults: FaultInjector;
  /** Waits for a call to finish (an adapter that backs off needs its clock run forward). */
  settle<T>(call: Promise<T>): Promise<T>;
}

/** Variations of the subject some cases need. */
export interface SubjectOptions {
  /** No Bid organisation, as until it exists. */
  readonly withoutBid?: boolean;
}

function must<T>(result: Result<T, string>): T {
  if (!result.ok) throw new Error(`fixture refused: ${result.refusal.code}`);
  return result.value;
}

/*
 * London Art Exchange (Shop, lax.art) is not VAT registered, so its documents carry no VAT. The
 * VAT cases run against the Bid organisation, which the fixtures model as registered only so that
 * the VAT paths have somewhere to run (the real answer is an open owner/accountant question).
 */
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
const NO_VAT_GOODS: LineInput = {
  description: "Print, edition 1/50",
  quantity: 1,
  unitNetPence: 10_000,
  treatment: "outside_scope",
  role: "goods",
};
const NO_VAT_DELIVERY: LineInput = {
  description: "Delivery",
  quantity: 1,
  unitNetPence: 1_500,
  treatment: "outside_scope",
  role: "delivery",
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

function bill(product: Product, sourceId: string, lines: LineInput[], contactId = "seller-1") {
  return must(
    buildBill({
      product,
      sourceId,
      contactReference: contact(product, contactId).reference,
      issuedOn: "2026-11-12",
      dueOn: "2026-11-19",
      lines,
    }),
  );
}

function issuedOf(outcome: IssueOutcome) {
  if (outcome.status !== "issued") {
    const why = "reason" in outcome ? outcome.reason : "detail" in outcome ? outcome.detail : "";
    throw new Error(`expected issued, got ${outcome.status} ${why ?? ""}`);
  }
  return outcome;
}

/**
 * One suite, run against every implementation of the accounting ports: the in-memory fake and the
 * Books adapter. If both pass, code written against the fake behaves the same against Books.
 */
export function runAccountingContract(
  api: TestApi,
  makeSubject: (options?: SubjectOptions) => AccountingSubject | Promise<AccountingSubject>,
): void {
  const { describe, it, expect } = api;

  /** A subject that already holds the buyer's contact for the product. */
  async function withContact(product: Product = SHOP) {
    const s = await makeSubject();
    issuedOf(await s.settle(s.ports.contacts.upsertContact(contact(product))));
    return s;
  }

  async function notIssued(
    s: AccountingSubject,
    product: Product,
    kind: "invoice" | "bill" | "credit_note" | "payment",
    reference: string,
  ) {
    const found = await s.settle(s.ports.lookup.findByReference(product, kind, reference));
    expect(found.status).toBe("not_found");
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

      it("keeps a person's customer and vendor contacts apart, each created once", async () => {
        const s = await makeSubject();
        const person = contact(SHOP, "both");
        const customer = issuedOf(await s.settle(s.ports.contacts.upsertContact(person)));
        const vendor = issuedOf(await s.settle(s.ports.vendors.upsertVendor(person)));
        const vendorAgain = issuedOf(await s.settle(s.ports.vendors.upsertVendor(person)));
        expect(vendor.providerId === customer.providerId).toBe(false);
        expect(vendorAgain.providerId).toBe(vendor.providerId);
      });
    });

    describe("invoices", () => {
      it("issues a VAT invoice whose totals equal ours exactly", async () => {
        const s = await withContact(BID);
        const doc = invoice(BID, "inv-1", [GOODS, DELIVERY]);
        const out = issuedOf(await s.settle(s.ports.invoices.issueInvoice(doc)));
        expect(compareWithProviderTotals(doc.totals, out.totals)).toEqual({ matches: true });
        expect(out.number === "").toBe(false);
      });

      it("handles zero rated, margin scheme and multi-quantity lines", async () => {
        const s = await withContact(BID);
        const doc = invoice(BID, "inv-mixed", [MARGIN, ZERO, GOODS]);
        const out = issuedOf(await s.settle(s.ports.invoices.issueInvoice(doc)));
        expect(out.totals).toEqual(doc.totals);
      });

      it("issues an invoice with no VAT for the organisation that is not VAT registered", async () => {
        const s = await withContact(SHOP);
        const doc = invoice(SHOP, "inv-novat", [NO_VAT_GOODS, NO_VAT_DELIVERY]);
        const out = issuedOf(await s.settle(s.ports.invoices.issueInvoice(doc)));
        expect(out.totals).toEqual(doc.totals);
        expect(out.totals.vatPence).toBe(0);
      });

      it("never makes a second invoice for the same reference", async () => {
        const s = await withContact();
        const doc = invoice(SHOP, "inv-dup", [NO_VAT_GOODS]);
        const first = issuedOf(await s.settle(s.ports.invoices.issueInvoice(doc)));
        const again = issuedOf(await s.settle(s.ports.invoices.issueInvoice(doc)));
        expect(again.providerId).toBe(first.providerId);
        expect(again.number).toBe(first.number);
      });

      it("refuses an invoice for a contact that does not exist", async () => {
        const s = await makeSubject();
        const out = await s.settle(
          s.ports.invoices.issueInvoice(invoice(SHOP, "inv-orphan", [NO_VAT_GOODS])),
        );
        expect(out).toEqual({ status: "rejected", reason: "zoho_books_contact_missing" });
      });

      it("refuses an invoice to a person held only as a vendor", async () => {
        const s = await makeSubject();
        issuedOf(await s.settle(s.ports.vendors.upsertVendor(contact(SHOP))));
        const doc = invoice(SHOP, "inv-vendor", [NO_VAT_GOODS]);
        const out = await s.settle(s.ports.invoices.issueInvoice(doc));
        expect(out).toEqual({ status: "rejected", reason: "zoho_books_contact_missing" });
        await notIssued(s, SHOP, "invoice", doc.reference);
      });

      it("finds an issued invoice by reference with the same identity and totals", async () => {
        const s = await withContact();
        const doc = invoice(SHOP, "inv-find", [NO_VAT_GOODS]);
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
        await notIssued(s, SHOP, "invoice", invoice(SHOP, "inv-never", [NO_VAT_GOODS]).reference);
      });

      it("is unavailable for a reference of another kind or product", async () => {
        const s = await withContact();
        const doc = invoice(SHOP, "inv-kind", [NO_VAT_GOODS]);
        issuedOf(await s.settle(s.ports.invoices.issueInvoice(doc)));
        const wrongKind = await s.settle(
          s.ports.lookup.findByReference(SHOP, "bill", doc.reference),
        );
        expect(wrongKind.status).toBe("unavailable");
        const wrongProduct = await s.settle(
          s.ports.lookup.findByReference("lax_art", "invoice", doc.reference),
        );
        expect(wrongProduct.status).toBe("unavailable");
      });

      it("keeps the two legal entities' books apart", async () => {
        const s = await makeSubject();
        issuedOf(await s.settle(s.ports.contacts.upsertContact(contact(BID))));
        issuedOf(await s.settle(s.ports.contacts.upsertContact(contact(SHOP))));
        issuedOf(await s.settle(s.ports.invoices.issueInvoice(invoice(BID, "same-id", [GOODS]))));
        await notIssued(s, SHOP, "invoice", invoice(SHOP, "same-id", [GOODS]).reference);
      });
    });

    describe("one organisation per document", () => {
      it("refuses a Bid invoice that claims the London Art Exchange entity, in neither organisation", async () => {
        const s = await makeSubject();
        issuedOf(await s.settle(s.ports.contacts.upsertContact(contact(BID))));
        issuedOf(await s.settle(s.ports.contacts.upsertContact(contact(SHOP))));
        const doc: Invoice = {
          ...invoice(BID, "cross-1", [GOODS]),
          entity: "london_art_exchange",
        };
        expect(await s.settle(s.ports.invoices.issueInvoice(doc))).toEqual({
          status: "rejected",
          reason: R.entityMismatch,
        });
        await notIssued(s, BID, "invoice", doc.reference);
      });

      it("refuses a Shop invoice that claims the Bid entity", async () => {
        const s = await makeSubject();
        issuedOf(await s.settle(s.ports.contacts.upsertContact(contact(BID))));
        issuedOf(await s.settle(s.ports.contacts.upsertContact(contact(SHOP))));
        const doc: Invoice = {
          ...invoice(SHOP, "cross-2", [NO_VAT_GOODS]),
          entity: "london_auction_xchange",
        };
        expect(await s.settle(s.ports.invoices.issueInvoice(doc))).toEqual({
          status: "rejected",
          reason: R.entityMismatch,
        });
        await notIssued(s, SHOP, "invoice", doc.reference);
      });

      it("refuses a Bid invoice whose contact is a Shop contact, even when both exist", async () => {
        const s = await makeSubject();
        issuedOf(await s.settle(s.ports.contacts.upsertContact(contact(BID))));
        issuedOf(await s.settle(s.ports.contacts.upsertContact(contact(SHOP))));
        const doc: Invoice = {
          ...invoice(BID, "cross-3", [GOODS]),
          contactReference: contact(SHOP).reference,
        };
        expect(await s.settle(s.ports.invoices.issueInvoice(doc))).toEqual({
          status: "rejected",
          reason: R.entityMismatch,
        });
        await notIssued(s, BID, "invoice", doc.reference);
      });

      it("refuses a document for the Bid entity while its organisation is not configured", async () => {
        const s = await makeSubject({ withoutBid: true });
        expect(await s.settle(s.ports.contacts.upsertContact(contact(BID)))).toEqual({
          status: "rejected",
          reason: R.organisationNotConfigured,
        });
        const found = await s.settle(
          s.ports.lookup.findByReference(BID, "contact", contact(BID).reference),
        );
        expect(found.status).toBe("unavailable");
        issuedOf(await s.settle(s.ports.contacts.upsertContact(contact(SHOP))));
      });
    });

    describe("destination", () => {
      it("names the organisation each product's documents go to, the one chosen for the document", async () => {
        const s = await makeSubject();
        const { destination } = s.ports;
        expect(destination.destinationFor(BID)).toEqual({
          kind: "organisation",
          organisationId: BID_ORG_ID,
        });
        expect(destination.destinationFor(SHOP)).toEqual({
          kind: "organisation",
          organisationId: SHOP_ORG_ID,
        });
        expect(destination.destinationFor("lax_art")).toEqual({
          kind: "organisation",
          organisationId: SHOP_ORG_ID,
        });
      });

      it("cannot name one for a product whose organisation is not configured", async () => {
        const s = await makeSubject({ withoutBid: true });
        expect(s.ports.destination.destinationFor(BID)).toEqual({
          kind: "unconfigured",
          reason: R.organisationNotConfigured,
        });
      });
    });

    describe("VAT registration", () => {
      it("refuses a VAT line for the organisation that is not VAT registered, and creates nothing", async () => {
        const s = await withContact(SHOP);
        const doc = invoice(SHOP, "inv-vat-lae", [GOODS]);
        expect(await s.settle(s.ports.invoices.issueInvoice(doc))).toEqual({
          status: "rejected",
          reason: R.vatOnUnregisteredEntity,
        });
        await notIssued(s, SHOP, "invoice", doc.reference);
      });

      it("refuses a standard-rated line with no VAT in it for that organisation too", async () => {
        const s = await withContact(SHOP);
        const doc = invoice(SHOP, "inv-vat-1p", [{ ...GOODS, unitNetPence: 2 }]);
        expect(doc.totals.vatPence).toBe(0);
        expect(await s.settle(s.ports.invoices.issueInvoice(doc))).toEqual({
          status: "rejected",
          reason: R.vatOnUnregisteredEntity,
        });
      });

      it("refuses a VAT bill for that organisation", async () => {
        const s = await makeSubject();
        issuedOf(await s.settle(s.ports.vendors.upsertVendor(contact(SHOP, "seller-1"))));
        const doc = bill(SHOP, "bill-vat-lae", [GOODS]);
        expect(await s.settle(s.ports.bills.issueBill(doc))).toEqual({
          status: "rejected",
          reason: R.vatOnUnregisteredEntity,
        });
        await notIssued(s, SHOP, "bill", doc.reference);
      });
    });

    describe("payments", () => {
      async function twoInvoices() {
        const s = await withContact();
        const a = invoice(SHOP, "pay-a", [NO_VAT_GOODS]);
        const b = invoice(SHOP, "pay-b", [NO_VAT_GOODS, NO_VAT_DELIVERY]);
        issuedOf(await s.settle(s.ports.invoices.issueInvoice(a)));
        issuedOf(await s.settle(s.ports.invoices.issueInvoice(b)));
        return { s, a, b };
      }
      const pay = (sourceId: string, a: Invoice, b: Invoice, amountPence = 40_000) =>
        must(
          buildPayment({
            product: SHOP,
            sourceId,
            contactReference: a.contactReference,
            receivedOn: "2026-11-12",
            amountPence,
            allocations: [
              { invoiceReference: a.reference, amountPence: a.totals.grossPence },
              { invoiceReference: b.reference, amountPence: b.totals.grossPence },
            ],
          }),
        );

      it("records a payment across several invoices, the rest left unallocated", async () => {
        const { s, a, b } = await twoInvoices();
        const payment = pay("pay-1", a, b);
        const out = issuedOf(await s.settle(s.ports.payments.recordPayment(payment)));
        expect(out.totals).toEqual(expectedTotals(payment));
        const again = issuedOf(await s.settle(s.ports.payments.recordPayment(payment)));
        expect(again.providerId).toBe(out.providerId);
      });

      it("holds for a person a payment held under our reference with other allocations", async () => {
        const { s, a, b } = await twoInvoices();
        const first = issuedOf(await s.settle(s.ports.payments.recordPayment(pay("pay-2", a, b))));
        const changed = {
          ...pay("pay-2", a, b),
          allocations: [{ invoiceReference: a.reference, amountPence: a.totals.grossPence }],
        };
        const held = await s.settle(s.ports.payments.recordPayment(changed));
        // Books holds a payment under our reference that is not ours: kept with its identity for a
        // person, never a refusal that could be retried.
        expect(held).toEqual({
          status: "differs",
          reason: R.paymentMismatch,
          number: first.number,
          providerId: first.providerId,
          pdfRef: first.pdfRef,
          totals: first.totals,
        });
      });

      it("a payment Books makes but reads back different is held with its identity, and never made twice", async () => {
        const { s, a, b } = await twoInvoices();
        const payment = pay("pay-read-back", a, b);
        s.faults.inject("read_back_differs");
        const made = await s.settle(s.ports.payments.recordPayment(payment));
        // It exists in Books: never a refusal (which could be retried as a new create).
        if (made.status !== "differs") throw new Error(`expected differs, got ${made.status}`);
        expect(made.reason).toBe(R.paymentMismatch);
        expect(made.totals).toEqual(expectedTotals(payment));
        // Sent again it is the same payment, held again: never a second one.
        const again = await s.settle(s.ports.payments.recordPayment(payment));
        expect(again).toEqual(made);
        const found = await s.settle(
          s.ports.lookup.findByReference(SHOP, "payment", payment.reference),
        );
        expect(found.status === "found" ? found.providerId : found.status).toBe(made.providerId);
      });

      it("a lost answer on a payment is unknown, it can be found, and a resend is the same payment", async () => {
        const { s, a, b } = await twoInvoices();
        const payment = pay("pay-lost", a, b);
        s.faults.inject("timeout_after_commit");
        expect((await s.settle(s.ports.payments.recordPayment(payment))).status).toBe("unknown");
        const found = await s.settle(
          s.ports.lookup.findByReference(SHOP, "payment", payment.reference),
        );
        expect(found.status).toBe("found");
        const resent = issuedOf(await s.settle(s.ports.payments.recordPayment(payment)));
        if (found.status === "found") expect(resent.providerId).toBe(found.providerId);
      });

      it("refuses a payment against an invoice that does not exist", async () => {
        const s = await withContact();
        const ghost = invoice(SHOP, "ghost", [NO_VAT_GOODS]);
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
        expect(await s.settle(s.ports.payments.recordPayment(payment))).toEqual({
          status: "rejected",
          reason: "zoho_books_invoice_missing",
        });
      });
    });

    describe("credit notes", () => {
      function credited(source: Invoice, sourceId = "cn-1") {
        return must(
          buildCreditNoteFor(source, {
            sourceId,
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

      it("issues a partial VAT credit note on an issued invoice with matching totals", async () => {
        const s = await withContact(BID);
        const inv = invoice(BID, "cn-inv", [GOODS, DELIVERY]);
        issuedOf(await s.settle(s.ports.invoices.issueInvoice(inv)));
        const note = credited(inv);
        const out = issuedOf(await s.settle(s.ports.creditNotes.issueCreditNote(note)));
        expect(compareWithProviderTotals(note.totals, out.totals)).toEqual({ matches: true });
      });

      it("refuses, and sends nothing for, a credit whose VAT Books would work out a penny differently", async () => {
        const s = await withContact(BID);
        // 21p + 4p VAT; crediting 3p of the 25p gross carries 0p VAT by the domain's cumulative
        // allocation, but Books would take 3 x 20/120 = 0.5p, rounded to 1p.
        const inv = invoice(BID, "cn-penny", [{ ...GOODS, unitNetPence: 21 }]);
        issuedOf(await s.settle(s.ports.invoices.issueInvoice(inv)));
        const note = must(
          buildCreditNoteFor(inv, {
            sourceId: "cn-penny",
            issuedOn: "2026-11-13",
            buckets: {
              paidGoodsPence: 25,
              paidDeliveryPence: 0,
              refundedGoodsPence: 0,
              refundedDeliveryPence: 0,
            },
            request: { goodsPence: 3, deliveryPence: 0 },
            priorCredits: [],
          }),
        );
        expect(note.totals).toEqual({ netPence: 3, vatPence: 0, grossPence: 3 });
        expect(await s.settle(s.ports.creditNotes.issueCreditNote(note))).toEqual({
          status: "rejected",
          reason: R.vatDiffersFromBooks,
        });
        await notIssued(s, BID, "credit_note", note.reference);
      });

      it("a credit note a penny off on read-back is reported as it is, never adjusted", async () => {
        const s = await withContact(BID);
        const inv = invoice(BID, "cn-drift", [GOODS, DELIVERY]);
        issuedOf(await s.settle(s.ports.invoices.issueInvoice(inv)));
        const note = credited(inv, "cn-drift");
        s.faults.inject("totals_drift");
        const out = issuedOf(await s.settle(s.ports.creditNotes.issueCreditNote(note)));
        expect(compareWithProviderTotals(note.totals, out.totals).matches).toBe(false);
      });

      it("a lost answer on a credit note is unknown, and a resend is the same credit note", async () => {
        const s = await withContact(BID);
        const inv = invoice(BID, "cn-lost", [GOODS, DELIVERY]);
        issuedOf(await s.settle(s.ports.invoices.issueInvoice(inv)));
        const note = credited(inv, "cn-lost");
        s.faults.inject("timeout_after_commit");
        expect((await s.settle(s.ports.creditNotes.issueCreditNote(note))).status).toBe("unknown");
        const found = await s.settle(
          s.ports.lookup.findByReference(BID, "credit_note", note.reference),
        );
        expect(found.status).toBe("found");
        const resent = issuedOf(await s.settle(s.ports.creditNotes.issueCreditNote(note)));
        if (found.status === "found") expect(resent.providerId).toBe(found.providerId);
      });

      it("refuses a credit note for an invoice that was never issued", async () => {
        const s = await withContact(BID);
        const note = credited(invoice(BID, "cn-missing", [GOODS, DELIVERY]));
        expect(await s.settle(s.ports.creditNotes.issueCreditNote(note))).toEqual({
          status: "rejected",
          reason: "zoho_books_invoice_missing",
        });
      });
    });

    describe("bills", () => {
      it("issues a VAT bill to a vendor", async () => {
        const s = await makeSubject();
        issuedOf(await s.settle(s.ports.vendors.upsertVendor(contact(BID, "seller-1"))));
        const doc = bill(BID, "bill-1", [{ ...GOODS, description: "Seller payout" }]);
        const out = issuedOf(await s.settle(s.ports.bills.issueBill(doc)));
        expect(out.totals).toEqual(doc.totals);
      });

      it("issues a bill with no VAT to a vendor of the organisation that is not VAT registered", async () => {
        const s = await makeSubject();
        issuedOf(await s.settle(s.ports.vendors.upsertVendor(contact(SHOP, "seller-1"))));
        const doc = bill(SHOP, "bill-novat", [{ ...NO_VAT_GOODS, description: "Artist payout" }]);
        const out = issuedOf(await s.settle(s.ports.bills.issueBill(doc)));
        expect(out.totals).toEqual(doc.totals);
      });

      it("refuses a bill to a person held only as a customer", async () => {
        const s = await makeSubject();
        issuedOf(await s.settle(s.ports.contacts.upsertContact(contact(SHOP, "seller-1"))));
        const doc = bill(SHOP, "bill-customer", [NO_VAT_GOODS]);
        expect(await s.settle(s.ports.bills.issueBill(doc))).toEqual({
          status: "rejected",
          reason: "zoho_books_contact_missing",
        });
        await notIssued(s, SHOP, "bill", doc.reference);
      });
    });

    describe("lookup faults", () => {
      it("an unreadable search is unavailable, never not_found", async () => {
        const s = await withContact();
        s.faults.inject("lookup_unavailable");
        const ref = invoice(SHOP, "inv-unread", [NO_VAT_GOODS]).reference;
        expect((await s.settle(s.ports.lookup.findByReference(SHOP, "invoice", ref))).status).toBe(
          "unavailable",
        );
      });

      it("two documents for one reference are ambiguous", async () => {
        const s = await withContact();
        s.faults.inject("lookup_ambiguous");
        const ref = invoice(SHOP, "inv-amb", [NO_VAT_GOODS]).reference;
        expect((await s.settle(s.ports.lookup.findByReference(SHOP, "invoice", ref))).status).toBe(
          "ambiguous",
        );
      });

      it("a dependency that cannot be confirmed is unknown and nothing is created", async () => {
        const s = await withContact();
        const doc = invoice(SHOP, "inv-dep-unread", [NO_VAT_GOODS]);
        s.faults.inject("lookup_unavailable");
        expect((await s.settle(s.ports.invoices.issueInvoice(doc))).status).toBe("unknown");
        await notIssued(s, SHOP, "invoice", doc.reference);
      });

      it("an ambiguous dependency is a rejection and nothing is created", async () => {
        const s = await withContact();
        const doc = invoice(SHOP, "inv-dep-amb", [NO_VAT_GOODS]);
        s.faults.inject("lookup_ambiguous");
        expect(await s.settle(s.ports.invoices.issueInvoice(doc))).toEqual({
          status: "rejected",
          reason: "zoho_books_contact_ambiguous",
        });
        await notIssued(s, SHOP, "invoice", doc.reference);
      });
    });

    describe("faults", () => {
      it("a lost answer is unknown, the document can be found, and a resend is the same document", async () => {
        const s = await withContact();
        const doc = invoice(SHOP, "inv-lost", [NO_VAT_GOODS]);
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
        const doc = invoice(SHOP, "inv-limited", [NO_VAT_GOODS]);
        s.faults.inject("rate_limited");
        expect((await s.settle(s.ports.invoices.issueInvoice(doc))).status).toBe("rejected");
        s.faults.clear();
        await notIssued(s, SHOP, "invoice", doc.reference);
      });

      it("a locked period is a clean rejection and nothing is created", async () => {
        const s = await withContact();
        const doc = invoice(SHOP, "inv-locked", [NO_VAT_GOODS]);
        s.faults.inject("locked_period");
        expect((await s.settle(s.ports.invoices.issueInvoice(doc))).status).toBe("rejected");
        await notIssued(s, SHOP, "invoice", doc.reference);
      });

      it("a total that is a penny off is reported as it is, never adjusted away", async () => {
        const s = await withContact(BID);
        const doc = invoice(BID, "inv-drift", [GOODS]);
        s.faults.inject("totals_drift");
        const out = issuedOf(await s.settle(s.ports.invoices.issueInvoice(doc)));
        const match = compareWithProviderTotals(doc.totals, out.totals);
        expect(match.matches).toBe(false);
        expect(out.totals.grossPence).toBe(doc.totals.grossPence + 1);
      });
    });
  });
}
