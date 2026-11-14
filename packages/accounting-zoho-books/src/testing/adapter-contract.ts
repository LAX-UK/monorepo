import {
  type AccountingDocument,
  type Invoice,
  type IssueOutcome,
  type LineInput,
  type Product,
  type Result,
  buildBill,
  buildContact,
  buildCreditNoteFor,
  buildInclusiveInvoice,
  buildInvoice,
  buildPayment,
  compareWithProviderTotals,
  expectedTotals,
  isLockedPeriodReason,
  legalEntityFor,
} from "@auction/accounting-domain";
import type { AccountingPorts } from "../adapter/index.js";
import { ZOHO_BOOKS_REJECTIONS as R } from "../adapter/rejections.js";
import { isTransientRejection } from "../outcome.js";
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

  /** Nothing is held for the document (looked for as its own product's entity would hold it). */
  async function notIssued(s: AccountingSubject, document: AccountingDocument) {
    const asFiled = { ...document, entity: legalEntityFor(document.product) } as AccountingDocument;
    const found = await s.settle(s.ports.lookup.findDocument(asFiled));
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
        await notIssued(s, doc);
      });

      it("finds an issued invoice by reference with the same identity and totals", async () => {
        const s = await withContact();
        const doc = invoice(SHOP, "inv-find", [NO_VAT_GOODS]);
        const out = issuedOf(await s.settle(s.ports.invoices.issueInvoice(doc)));
        const found = await s.settle(s.ports.lookup.findDocument(doc));
        expect(found.status).toBe("found");
        if (found.status !== "found") return;
        expect(found.providerId).toBe(out.providerId);
        expect(found.number).toBe(out.number);
        expect(found.totals).toEqual(out.totals);
      });

      it("reports not_found for a reference nothing was issued for", async () => {
        const s = await withContact();
        await notIssued(s, invoice(SHOP, "inv-never", [NO_VAT_GOODS]));
      });

      it("is unavailable for a reference of another kind or product", async () => {
        const s = await withContact();
        const doc = invoice(SHOP, "inv-kind", [NO_VAT_GOODS]);
        issuedOf(await s.settle(s.ports.invoices.issueInvoice(doc)));
        const wrongKind = await s.settle(
          s.ports.lookup.findDocument({
            ...doc,
            reference: doc.reference.replace("-INV-", "-BILL-"),
          }),
        );
        expect(wrongKind.status).toBe("unavailable");
        const wrongProduct = await s.settle(
          s.ports.lookup.findDocument({
            ...doc,
            reference: doc.reference.replace("-SHOP-", "-ART-"),
          }),
        );
        expect(wrongProduct.status).toBe("unavailable");
      });

      it("keeps the two legal entities' books apart", async () => {
        const s = await makeSubject();
        issuedOf(await s.settle(s.ports.contacts.upsertContact(contact(BID))));
        issuedOf(await s.settle(s.ports.contacts.upsertContact(contact(SHOP))));
        issuedOf(await s.settle(s.ports.invoices.issueInvoice(invoice(BID, "same-id", [GOODS]))));
        await notIssued(s, invoice(SHOP, "same-id", [GOODS]));
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
        await notIssued(s, doc);
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
        await notIssued(s, doc);
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
        await notIssued(s, doc);
      });

      it("refuses a document for the Bid entity while its organisation is not configured", async () => {
        const s = await makeSubject({ withoutBid: true });
        expect(await s.settle(s.ports.contacts.upsertContact(contact(BID)))).toEqual({
          status: "rejected",
          reason: R.organisationNotConfigured,
        });
        const found = await s.settle(s.ports.lookup.findDocument(contact(BID)));
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

    describe("Shop invoices LAX numbered", () => {
      const shopInvoice = (orderId: string, number: string) =>
        must(
          buildInclusiveInvoice({
            product: SHOP,
            sourceId: orderId,
            contactReference: contact(SHOP).reference,
            issuedOn: "2026-11-12",
            dueOn: "2026-11-12",
            number,
            lines: [
              {
                description: "Print, edition 1/50",
                grossPence: 45_000,
                vatPence: 0,
                treatment: "outside_scope",
                role: "goods",
              },
              {
                description: "Framing: Natural oak",
                grossPence: 12_000,
                vatPence: 0,
                treatment: "outside_scope",
                role: "goods",
              },
              {
                description: "UK insured delivery",
                grossPence: 2_500,
                vatPence: 0,
                treatment: "outside_scope",
                role: "delivery",
              },
            ],
          }),
        );

      it("keeps the Shop's own number, so Books continues the LAX-INV- series", async () => {
        const s = await withContact(SHOP);
        const issued = issuedOf(
          await s.settle(s.ports.invoices.issueInvoice(shopInvoice("order-1", "LAX-INV-000124"))),
        );
        expect(issued.number).toBe("LAX-INV-000124");
        expect(issued.totals).toEqual({ netPence: 59_500, vatPence: 0, grossPence: 59_500 });
      });

      it("refuses a number Books already holds rather than renumbering it", async () => {
        const s = await withContact(SHOP);
        issuedOf(
          await s.settle(s.ports.invoices.issueInvoice(shopInvoice("order-1", "LAX-INV-000124"))),
        );
        const again = await s.settle(
          s.ports.invoices.issueInvoice(shopInvoice("order-2", "LAX-INV-000124")),
        );
        expect(again.status).toBe("rejected");
        await notIssued(s, shopInvoice("order-2", "LAX-INV-000124"));
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
        await notIssued(s, doc);
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
        await notIssued(s, doc);
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

      it("records one payment applied exactly across every invoice it settles (Pay several)", async () => {
        const { s, a, b } = await twoInvoices();
        const exact = a.totals.grossPence + b.totals.grossPence;
        const payment = pay("pay-several", a, b, exact);
        expect(payment.kind === "payment" && payment.unallocatedPence).toBe(0);
        const out = issuedOf(await s.settle(s.ports.payments.recordPayment(payment)));
        expect(out.totals).toEqual(expectedTotals(payment));
        expect(out.totals.grossPence).toBe(exact);
      });

      it("refuses a payment whose invoice is not in the books yet, posting nothing; then records it once", async () => {
        const s = await withContact();
        const a = invoice(SHOP, "pay-early-a", [NO_VAT_GOODS]);
        const b = invoice(SHOP, "pay-early-b", [NO_VAT_GOODS]);
        issuedOf(await s.settle(s.ports.invoices.issueInvoice(a)));
        const payment = pay("pay-early", a, b, a.totals.grossPence + b.totals.grossPence);
        const early = await s.settle(s.ports.payments.recordPayment(payment));
        expect(early).toEqual({ status: "rejected", reason: "zoho_books_invoice_missing" });
        expect(await s.settle(s.ports.lookup.findDocument(payment))).toEqual({
          status: "not_found",
        });
        issuedOf(await s.settle(s.ports.invoices.issueInvoice(b)));
        const made = issuedOf(await s.settle(s.ports.payments.recordPayment(payment)));
        const again = issuedOf(await s.settle(s.ports.payments.recordPayment(payment)));
        expect(again.providerId).toBe(made.providerId);
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
        // A lookup reads it back with the same check: differs, with the same identity, never found.
        expect(await s.settle(s.ports.lookup.findDocument(payment))).toEqual(made);
      });

      it("a payment held under our reference with other allocations is differs on lookup, not found", async () => {
        const { s, a, b } = await twoInvoices();
        const first = issuedOf(await s.settle(s.ports.payments.recordPayment(pay("pay-3", a, b))));
        const ours = {
          ...pay("pay-3", a, b),
          allocations: [{ invoiceReference: a.reference, amountPence: a.totals.grossPence }],
        };
        // As after a lost answer: only the lookup can tell, and it must read the payment back.
        expect(await s.settle(s.ports.lookup.findDocument(ours))).toEqual({
          status: "differs",
          reason: R.paymentMismatch,
          number: first.number,
          providerId: first.providerId,
          pdfRef: first.pdfRef,
          totals: first.totals,
        });
        expect((await s.settle(s.ports.lookup.findDocument(pay("pay-3", a, b)))).status).toBe(
          "found",
        );
      });

      it("a lost answer on a payment is unknown, it can be found, and a resend is the same payment", async () => {
        const { s, a, b } = await twoInvoices();
        const payment = pay("pay-lost", a, b);
        s.faults.inject("timeout_after_commit");
        expect((await s.settle(s.ports.payments.recordPayment(payment))).status).toBe("unknown");
        const found = await s.settle(s.ports.lookup.findDocument(payment));
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
        await notIssued(s, note);
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
        const found = await s.settle(s.ports.lookup.findDocument(note));
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
        await notIssued(s, doc);
      });
    });

    describe("write fence", () => {
      const lost = { mayWrite: async () => false };
      const held = { mayWrite: async () => true };
      const FENCED = { status: "rejected", reason: "zoho_books_fenced_lease_lost" };

      it("a create its fence refuses is rejected as passing, and nothing is created", async () => {
        const s = await withContact();
        const doc = invoice(SHOP, "inv-fenced", [NO_VAT_GOODS]);
        expect(await s.settle(s.ports.invoices.issueInvoice(doc, lost))).toEqual(FENCED);
        expect(isTransientRejection(FENCED.reason)).toBe(true);
        await notIssued(s, doc);
        issuedOf(await s.settle(s.ports.invoices.issueInvoice(doc, held)));
      });

      it("refuses every kind's write, a contact's update included", async () => {
        const s = await withContact();
        expect(await s.settle(s.ports.contacts.upsertContact(contact(SHOP), lost))).toEqual(FENCED);
        expect(
          await s.settle(s.ports.contacts.upsertContact(contact(SHOP, "new-1"), lost)),
        ).toEqual(FENCED);
        expect(await s.settle(s.ports.vendors.upsertVendor(contact(SHOP, "v-1"), lost))).toEqual(
          FENCED,
        );
        const a = invoice(SHOP, "inv-for-pay-fenced", [NO_VAT_GOODS]);
        issuedOf(await s.settle(s.ports.invoices.issueInvoice(a)));
        const payment = must(
          buildPayment({
            product: SHOP,
            sourceId: "pay-fenced",
            contactReference: a.contactReference,
            receivedOn: "2026-11-12",
            amountPence: a.totals.grossPence,
            allocations: [{ invoiceReference: a.reference, amountPence: a.totals.grossPence }],
          }),
        );
        expect(await s.settle(s.ports.payments.recordPayment(payment, lost))).toEqual(FENCED);
        await notIssued(s, payment);
        issuedOf(await s.settle(s.ports.vendors.upsertVendor(contact(SHOP, "seller-1"))));
        const payout = bill(SHOP, "bill-fenced", [NO_VAT_GOODS]);
        expect(await s.settle(s.ports.bills.issueBill(payout, lost))).toEqual(FENCED);
        await notIssued(s, payout);
      });
    });

    describe("lookup faults", () => {
      it("an unreadable search is unavailable, never not_found", async () => {
        const s = await withContact();
        s.faults.inject("lookup_unavailable");
        const ref = invoice(SHOP, "inv-unread", [NO_VAT_GOODS]);
        expect((await s.settle(s.ports.lookup.findDocument(ref))).status).toBe("unavailable");
      });

      it("two documents for one reference are ambiguous", async () => {
        const s = await withContact();
        s.faults.inject("lookup_ambiguous");
        const ref = invoice(SHOP, "inv-amb", [NO_VAT_GOODS]);
        expect((await s.settle(s.ports.lookup.findDocument(ref))).status).toBe("ambiguous");
      });

      it("a dependency that cannot be confirmed is unknown and nothing is created", async () => {
        const s = await withContact();
        const doc = invoice(SHOP, "inv-dep-unread", [NO_VAT_GOODS]);
        s.faults.inject("lookup_unavailable");
        expect((await s.settle(s.ports.invoices.issueInvoice(doc))).status).toBe("unknown");
        await notIssued(s, doc);
      });

      it("an ambiguous dependency is a rejection and nothing is created", async () => {
        const s = await withContact();
        const doc = invoice(SHOP, "inv-dep-amb", [NO_VAT_GOODS]);
        s.faults.inject("lookup_ambiguous");
        expect(await s.settle(s.ports.invoices.issueInvoice(doc))).toEqual({
          status: "rejected",
          reason: "zoho_books_contact_ambiguous",
        });
        await notIssued(s, doc);
      });
    });

    describe("faults", () => {
      it("a lost answer is unknown, the document can be found, and a resend is the same document", async () => {
        const s = await withContact();
        const doc = invoice(SHOP, "inv-lost", [NO_VAT_GOODS]);
        s.faults.inject("timeout_after_commit");
        const lost = await s.settle(s.ports.invoices.issueInvoice(doc));
        expect(lost.status).toBe("unknown");
        const found = await s.settle(s.ports.lookup.findDocument(doc));
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
        await notIssued(s, doc);
      });

      it("a locked period is a clean rejection and nothing is created", async () => {
        const s = await withContact();
        const doc = invoice(SHOP, "inv-locked", [NO_VAT_GOODS]);
        s.faults.inject("locked_period");
        const out = await s.settle(s.ports.invoices.issueInvoice(doc));
        expect(out.status).toBe("rejected");
        if (out.status === "rejected") expect(isLockedPeriodReason(out.reason)).toBe(true);
        await notIssued(s, doc);
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

/** What the PDF contract needs: the ports, and whether a fetched PDF is a rehearsal stand-in. */
export interface PdfSubject {
  readonly ports: AccountingPorts;
  readonly rehearsal: boolean;
}

const BID_HAMMER: LineInput = {
  description: "Hammer price",
  quantity: 1,
  unitNetPence: 120_000,
  treatment: "margin_scheme",
  role: "goods",
};
const BID_PREMIUM: LineInput = {
  description: "Buyer's premium (25%)",
  quantity: 1,
  unitNetPence: 30_000,
  treatment: "margin_scheme",
  role: "goods",
};

/**
 * The stored copy's contract, for every implementation that can make one: the PDF of an invoice
 * it issued is fetched by the identity it gave, and nothing else is (a payment, a stranger's id).
 * A rehearsal says so (`rehearsal: true`), so it is never shown as the provider's own.
 */
export function runDocumentPdfContract(
  api: TestApi,
  makeSubject: () => PdfSubject | Promise<PdfSubject>,
): void {
  const { describe, it, expect } = api;

  async function issuedBidInvoice() {
    const s = await makeSubject();
    issuedOf(await s.ports.contacts.upsertContact(contact(BID)));
    const doc = invoice(BID, "pdf-1", [BID_HAMMER, BID_PREMIUM]);
    const issued = issuedOf(await s.ports.invoices.issueInvoice(doc));
    return { s, doc, issued };
  }

  describe("stored copy (PDF)", () => {
    it("fetches the PDF of an invoice it issued", async () => {
      const { s, doc, issued } = await issuedBidInvoice();
      const pdf = await s.ports.pdfs.fetchPdf(doc, issued);
      if (pdf.status !== "fetched") throw new Error(`expected fetched, got ${pdf.reason}`);
      expect(pdf.contentType).toBe("application/pdf");
      expect(new TextDecoder().decode(pdf.bytes.slice(0, 5))).toBe("%PDF-");
      expect(pdf.rehearsal).toBe(s.rehearsal);
    });

    it("has no PDF for a document it did not issue under that identity", async () => {
      const { s, doc, issued } = await issuedBidInvoice();
      const stranger = { ...issued, providerId: "someone-else" };
      expect((await s.ports.pdfs.fetchPdf(doc, stranger)).status).toBe("unavailable");
    });

    it("has no PDF for a payment", async () => {
      const { s, doc } = await issuedBidInvoice();
      const payment = must(
        buildPayment({
          product: BID,
          sourceId: "pdf-pay-1",
          contactReference: doc.contactReference,
          receivedOn: "2026-11-12",
          amountPence: doc.totals.grossPence,
          allocations: [{ invoiceReference: doc.reference, amountPence: doc.totals.grossPence }],
        }),
      );
      const recorded = issuedOf(await s.ports.payments.recordPayment(payment));
      expect((await s.ports.pdfs.fetchPdf(payment, recorded)).status).toBe("unavailable");
    });
  });
}
