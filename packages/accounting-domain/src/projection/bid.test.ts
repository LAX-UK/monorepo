import { describe, expect, it } from "vitest";
import type { CreditNote, Invoice } from "../document.js";
import { forAll, int } from "../testing/generate.js";
import {
  type BidInvoiceFacts,
  type BidRefundFacts,
  projectBidInvoiceRaised,
  projectBidPaymentRefunded,
} from "./bid.js";
import { ACCOUNTING_FLOWS, BUILT_FLOWS, PROJECTION_POLICIES } from "./flows.js";
import { whenReferenceHeld } from "./projection.js";

const INVOICE_ID = "0b6a7c1e-1111-4a5b-8c9d-000000000001";
const BUYER_ID = "0b6a7c1e-2222-4a5b-8c9d-000000000002";

const invoiceFacts = (over: Partial<BidInvoiceFacts> = {}): BidInvoiceFacts => ({
  invoiceId: INVOICE_ID,
  buyer: { legalEntityId: BUYER_ID, name: "Ada Collector", email: "ada@example.com" },
  raisedOn: "2026-11-12",
  dueOn: "2026-11-26",
  lines: [
    { kind: "hammer", label: "Hammer price", amountPence: 123_456 },
    { kind: "buyers_premium", label: "Buyer's premium (25%)", amountPence: 30_864 },
  ],
  ...over,
});

function must<T>(r: { ok: true; value: T } | { ok: false; refusal: { message: string } }): T {
  if (!r.ok) throw new Error(r.refusal.message);
  return r.value;
}

describe("Bid invoice raised", () => {
  it("projects the buyer's contact, then the invoice, to the penny", () => {
    const { documents } = must(projectBidInvoiceRaised(invoiceFacts()));
    expect(documents.map((d) => d.reference)).toEqual([
      `LAX-BID-CON-${BUYER_ID}`,
      `LAX-BID-INV-${INVOICE_ID}`,
    ]);
    const invoice = documents[1] as Invoice;
    expect(invoice).toMatchObject({
      entity: "london_auction_xchange",
      contactReference: `LAX-BID-CON-${BUYER_ID}`,
      issuedOn: "2026-11-12",
      dueOn: "2026-11-26",
      totals: { netPence: 154_320, vatPence: 0, grossPence: 154_320 },
    });
    expect(invoice.lines.map((l) => [l.description, l.unitNetPence, l.treatment, l.role])).toEqual([
      ["Hammer price", 123_456, "margin_scheme", "goods"],
      ["Buyer's premium (25%)", 30_864, "margin_scheme", "goods"],
    ]);
  });

  it("is idempotent: the same facts always give the same documents", () => {
    expect(projectBidInvoiceRaised(invoiceFacts())).toEqual(
      projectBidInvoiceRaised(invoiceFacts()),
    );
  });

  it("leaves out a line of nothing", () => {
    const facts = invoiceFacts({
      lines: [
        { kind: "hammer", label: "Hammer price", amountPence: 5_000 },
        { kind: "buyers_premium", label: "Buyer's premium (0%)", amountPence: 0 },
      ],
    });
    const invoice = must(projectBidInvoiceRaised(facts)).documents[1] as Invoice;
    expect(invoice.lines).toHaveLength(1);
    expect(invoice.totals.grossPence).toBe(5_000);
  });

  it("refuses a line kind waiting for the accountant instead of guessing its VAT", () => {
    for (const kind of ["vat_on_hammer", "artists_resale_right"]) {
      const facts = invoiceFacts({
        lines: [
          { kind: "hammer", label: "Hammer price", amountPence: 5_000 },
          { kind, label: kind, amountPence: 1_000 },
        ],
      });
      expect(projectBidInvoiceRaised(facts)).toMatchObject({
        ok: false,
        refusal: { code: "line_awaiting_accountant" },
      });
    }
  });

  it("refuses a line kind no one has named", () => {
    const facts = invoiceFacts({
      lines: [
        { kind: "hammer", label: "Hammer price", amountPence: 5_000 },
        { kind: "storage", label: "Storage", amountPence: 1_000 },
      ],
    });
    expect(projectBidInvoiceRaised(facts)).toMatchObject({
      ok: false,
      refusal: { code: "unmapped_line" },
    });
  });

  it("books the premium under the label it was raised with, never worked out again", () => {
    const label = "Buyer's premium (25% to £100,000, then 20%)";
    const facts = invoiceFacts({
      lines: [
        { kind: "hammer", label: "Hammer price", amountPence: 12_000_000 },
        // Not 25% of the hammer: the stored figure is what is booked.
        { kind: "buyers_premium", label, amountPence: 2_900_000 },
      ],
    });
    const invoice = must(projectBidInvoiceRaised(facts)).documents[1] as Invoice;
    expect(invoice.lines[1]).toMatchObject({ description: label, unitNetPence: 2_900_000 });
    expect(invoice.totals.grossPence).toBe(14_900_000);
  });

  it("does not take a booking from the object prototype", () => {
    const facts = invoiceFacts({ lines: [{ kind: "toString", label: "x", amountPence: 1 }] });
    expect(projectBidInvoiceRaised(facts)).toMatchObject({ ok: false });
  });

  it("keeps the contact but leaves off an email the books would refuse", () => {
    const facts = invoiceFacts({
      buyer: { legalEntityId: BUYER_ID, name: "Ada", email: "not an email" },
    });
    expect(must(projectBidInvoiceRaised(facts)).documents[0]).toMatchObject({ email: null });
  });

  it("refuses an id that cannot be a reference", () => {
    expect(projectBidInvoiceRaised(invoiceFacts({ invoiceId: "ABC" }))).toMatchObject({
      ok: false,
      refusal: { code: "bad_source_id" },
    });
  });
});

describe("Bid payment refunded", () => {
  const refund = (n: number, amountPence: number, refundedOn = "2026-11-20"): BidRefundFacts => ({
    refundId: `0b6a7c1e-4444-4a5b-8c9d-00000000000${n}`,
    amountPence,
    refundedOn,
  });
  const refunded = (refunds: BidRefundFacts[], paidPence = 154_320) => ({
    invoice: invoiceFacts(),
    paidPence,
    refunds,
  });

  it("gives one credit note per refund for exactly its amount, oldest first", () => {
    const { documents } = must(
      projectBidPaymentRefunded(refunded([refund(1, 1_001), refund(2, 50_000)])),
    );
    expect(documents.map((d) => d.kind)).toEqual([
      "contact",
      "invoice",
      "credit_note",
      "credit_note",
    ]);
    const [first, second] = documents.slice(2) as CreditNote[];
    expect(first?.totals.grossPence).toBe(1_001);
    expect(second?.totals.grossPence).toBe(50_000);
    expect(first?.invoiceReference).toBe(`LAX-BID-INV-${INVOICE_ID}`);
    expect(first?.reference).toBe("LAX-BID-CN-0b6a7c1e-4444-4a5b-8c9d-000000000001");
  });

  it("projects earlier credit notes again exactly, so a later refund never changes them", () => {
    const once = must(projectBidPaymentRefunded(refunded([refund(1, 1_001)]))).documents;
    const twice = must(
      projectBidPaymentRefunded(refunded([refund(1, 1_001), refund(2, 7)])),
    ).documents;
    expect(twice.slice(0, 3)).toEqual(once);
  });

  it("credits a full refund to the penny", () => {
    const note = must(projectBidPaymentRefunded(refunded([refund(1, 154_320)]))).documents[2];
    expect((note as CreditNote).totals).toEqual({
      netPence: 154_320,
      vatPence: 0,
      grossPence: 154_320,
    });
  });

  it("refuses refunds that add up to more than was paid", () => {
    expect(
      projectBidPaymentRefunded(refunded([refund(1, 100_000), refund(2, 54_321)])),
    ).toMatchObject({ ok: false, refusal: { code: "refund_refused" } });
  });

  it("never credits more than a part payment took", () => {
    expect(projectBidPaymentRefunded(refunded([refund(1, 100_001)], 100_000))).toMatchObject({
      ok: false,
    });
  });

  it("refuses a credit note dated before its invoice", () => {
    expect(projectBidPaymentRefunded(refunded([refund(1, 10, "2026-11-11")]))).toMatchObject({
      ok: false,
      refusal: { code: "bad_date" },
    });
  });

  it("property: credit notes always total exactly the refunds, never more than was paid", () => {
    forAll(200, (rng) => {
      const paid = int(rng, 1, 154_320);
      const refunds: BidRefundFacts[] = [];
      let left = paid;
      for (let i = 1; i <= int(rng, 1, 5) && left > 0; i++) {
        const amount = int(rng, 1, left);
        refunds.push(refund(i, amount));
        left -= amount;
      }
      const notes = must(projectBidPaymentRefunded(refunded(refunds, paid))).documents.slice(2);
      const credited = (notes as CreditNote[]).reduce((s, n) => s + n.totals.grossPence, 0);
      expect(credited).toBe(paid - left);
      expect(notes.map((n) => (n as CreditNote).totals.grossPence)).toEqual(
        refunds.map((r) => r.amountPence),
      );
    });
  });
});

describe("flows", () => {
  it("every flow has a policy, and the ones not built project nothing", () => {
    for (const flow of ACCOUNTING_FLOWS) {
      expect(typeof PROJECTION_POLICIES[flow]).toBe("function");
      if ((BUILT_FLOWS as readonly string[]).includes(flow)) continue;
      const policy = PROJECTION_POLICIES[flow] as (f: unknown) => unknown;
      expect(policy({ notBuilt: true })).toEqual({ ok: true, value: { documents: [] } });
    }
  });

  it("only contacts keep a held reference with other details", () => {
    expect(whenReferenceHeld("contact")).toBe("keep_held");
    for (const kind of ["invoice", "payment", "credit_note", "bill"] as const) {
      expect(whenReferenceHeld(kind)).toBe("must_match");
    }
  });
});
