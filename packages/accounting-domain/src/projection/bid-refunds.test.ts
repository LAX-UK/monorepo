import { describe, expect, it } from "vitest";
import { planCreditNoteRefund } from "../credit-note-refund.js";
import { documentsAwaited } from "../dependencies.js";
import type { AccountingDocument, CreditNote, Invoice } from "../document.js";
import { resolveParked } from "../release.js";
import { forAll, int } from "../testing/generate.js";
import {
  BID_DEFAULT_ACCOUNTING_TREATMENT,
  type BidBuyerDefaultFacts,
  type BidDeliveryRefundFacts,
  type BidRefundFacts,
  bidBuyerDefaultPolicy,
  bidDeliveryRefundedPolicy,
  deliveryCreditSourceId,
  projectBidBuyerDefault,
  projectBidDeliveryRefunded,
  projectBidPaymentRefunded,
  projectBidRefundReversed,
} from "./bid-refunds.js";
import type { BidInvoiceFacts } from "./bid.js";

const INVOICE_ID = "0b6a7c1e-1111-4a5b-8c9d-000000000001";
const BUYER_ID = "0b6a7c1e-2222-4a5b-8c9d-000000000002";
const GROUP_ID = "0b6a7c1e-3333-4a5b-8c9d-000000000003";
const QUOTE_ID = "0b6a7c1e-5555-4a5b-8c9d-000000000005";
const BUYER = { legalEntityId: BUYER_ID, name: "Ada Collector", email: "ada@example.com" };

const invoiceFacts = (over: Partial<BidInvoiceFacts> = {}): BidInvoiceFacts => ({
  invoiceId: INVOICE_ID,
  buyer: BUYER,
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

const notes = (documents: readonly AccountingDocument[]) =>
  documents.filter((d): d is CreditNote => d.kind === "credit_note");

describe("Bid payment refunded (flow 8, and each lot of a Pay several refund)", () => {
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

  it("gives one credit note per refund for exactly its amount, oldest first, under cn:<refund id>", () => {
    const { documents } = must(
      projectBidPaymentRefunded(refunded([refund(1, 1_001), refund(2, 50_000)])),
    );
    expect(documents.map((d) => d.kind)).toEqual([
      "contact",
      "invoice",
      "credit_note",
      "credit_note",
    ]);
    const [first, second] = notes(documents);
    expect(first?.totals.grossPence).toBe(1_001);
    expect(second?.totals.grossPence).toBe(50_000);
    expect(first?.invoiceReference).toBe(`LAX-BID-INV-${INVOICE_ID}`);
    expect(first?.reference).toBe("LAX-BID-CN-0b6a7c1e-4444-4a5b-8c9d-000000000001");
  });

  it("says each credit note's money went back from Stripe clearing, on the refund's day", () => {
    const [note] = notes(must(projectBidPaymentRefunded(refunded([refund(1, 500)]))).documents);
    expect(note?.refund).toEqual({ account: "stripe_clearing", refundedOn: "2026-11-20" });
    expect(must(planCreditNoteRefund(note as CreditNote))).toMatchObject({
      creditNoteReference: note?.reference,
      amountPence: 500,
      account: "stripe_clearing",
    });
  });

  it("credits the right lines: hammer first, then premium, VAT treatment kept", () => {
    const [note] = notes(
      must(projectBidPaymentRefunded(refunded([refund(1, 123_456 + 100)]))).documents,
    );
    expect(note?.lines.map((l) => [l.description, l.unitNetPence, l.treatment])).toEqual([
      ["Credit: Hammer price", 123_456, "margin_scheme"],
      ["Credit: Buyer's premium (25%)", 100, "margin_scheme"],
    ]);
  });

  it("projects earlier credit notes again exactly, so a later refund never changes them", () => {
    const once = must(projectBidPaymentRefunded(refunded([refund(1, 1_001)]))).documents;
    const twice = must(
      projectBidPaymentRefunded(refunded([refund(1, 1_001), refund(2, 7)])),
    ).documents;
    expect(twice.slice(0, 3)).toEqual(once);
  });

  it("keeps a refund's credit note already registered exactly as stored, and credits later refunds after it", () => {
    const [stored] = notes(must(projectBidPaymentRefunded(refunded([refund(1, 1_001)]))).documents);
    // As the earlier refund flow stored it: no `refund` on it.
    const { refund: _, ...earlier } = stored as CreditNote;
    const facts = { ...refunded([refund(1, 1_001), refund(2, 154_320)]), registered: [earlier] };
    const made = notes(must(projectBidPaymentRefunded(facts)).documents);
    expect(made[0]).toEqual(earlier);
    // Never more than was paid: the second takes only what is left after the stored one.
    expect(made[1]?.totals.grossPence).toBe(154_320 - 1_001);
  });

  it("a refund taken back (left out by the reader) never reshapes the credit notes of the refunds that stayed", () => {
    const both = notes(
      must(projectBidPaymentRefunded(refunded([refund(1, 123_456), refund(2, 1_000)]))).documents,
    );
    const second = both[1] as CreditNote;
    const after = notes(
      must(projectBidPaymentRefunded({ ...refunded([refund(2, 1_000)]), registered: both }))
        .documents,
    );
    expect(after).toEqual([second]);
  });

  it("credits a full refund to the penny", () => {
    const [note] = notes(must(projectBidPaymentRefunded(refunded([refund(1, 154_320)]))).documents);
    expect(note?.totals).toEqual({ netPence: 154_320, vatPence: 0, grossPence: 154_320 });
  });

  it("never credits more than was charged: the part above it is not this invoice's", () => {
    const { documents } = must(
      projectBidPaymentRefunded(refunded([refund(1, 100_000), refund(2, 54_321), refund(3, 9)])),
    );
    expect(notes(documents).map((n) => n.totals.grossPence)).toEqual([100_000, 54_320]);
  });

  it("never credits more than a lot's own payment took (Pay several member)", () => {
    const { documents } = must(projectBidPaymentRefunded(refunded([refund(1, 100_001)], 100_000)));
    expect(notes(documents).map((n) => n.totals.grossPence)).toEqual([100_000]);
  });

  it("refuses a payment said to take more than the invoice", () => {
    expect(projectBidPaymentRefunded(refunded([refund(1, 1)], 154_321))).toMatchObject({
      ok: false,
      refusal: { code: "payment_exceeds_invoice" },
    });
  });

  it("refuses a refund of nothing or less (a reversal must be netted by the reader)", () => {
    for (const amount of [0, -5, 1.5]) {
      expect(projectBidPaymentRefunded(refunded([refund(1, amount)]))).toMatchObject({
        ok: false,
        refusal: { code: "bad_amount" },
      });
    }
  });

  it("refuses a credit note dated before its invoice", () => {
    expect(projectBidPaymentRefunded(refunded([refund(1, 10, "2026-11-11")]))).toMatchObject({
      ok: false,
      refusal: { code: "bad_date" },
    });
  });

  it("a credit note waits for its contact and for the invoice it credits", () => {
    const [note] = notes(must(projectBidPaymentRefunded(refunded([refund(1, 10)]))).documents);
    expect(documentsAwaited(note as CreditNote)).toEqual([
      `LAX-BID-CON-${BUYER_ID}`,
      `LAX-BID-INV-${INVOICE_ID}`,
    ]);
  });

  it("property: credit notes total exactly min(refunds, paid), and each is at most its refund", () => {
    forAll(300, (rng) => {
      const paid = int(rng, 1, 154_320);
      const refunds: BidRefundFacts[] = [];
      for (let i = 1; i <= int(rng, 1, 6); i++) refunds.push(refund(i, int(rng, 1, paid)));
      const made = notes(must(projectBidPaymentRefunded(refunded(refunds, paid))).documents);
      const credited = made.reduce((s, n) => s + n.totals.grossPence, 0);
      const asked = refunds.reduce((s, r) => s + r.amountPence, 0);
      expect(credited).toBe(Math.min(asked, paid));
      for (const note of made) {
        const source = refunds.find((r) => note.reference.endsWith(r.refundId));
        expect(note.totals.grossPence).toBeLessThanOrEqual(source?.amountPence ?? 0);
      }
    });
  });
});

describe("courier delivery refunded inside Pay several (flow 9)", () => {
  const facts = (over: Partial<BidDeliveryRefundFacts> = {}): BidDeliveryRefundFacts => ({
    groupId: GROUP_ID,
    buyer: BUYER,
    quoteId: QUOTE_ID,
    chargedPence: 4_500,
    settledOn: "2026-11-13",
    refundedPence: 1_500,
    refundedOn: "2026-11-20",
    priorCredits: [],
    ...over,
  });
  const booked = { role: "delivery", treatment: "standard" } as const;

  it("credits the delivery invoice by what the running total rose by, parked with the draft", () => {
    const projection = must(projectBidDeliveryRefunded(facts()));
    const [note] = notes(projection.documents);
    expect(note?.reference).toBe(`LAX-BID-CN-${deliveryCreditSourceId(QUOTE_ID, 1_500)}`);
    expect(note?.invoiceReference).toBe(`LAX-BID-INV-dlv-${QUOTE_ID}`);
    expect(note?.totals.grossPence).toBe(1_500);
    expect(projection.parked?.map((p) => p.reason)).toEqual(["vat_on_delivery", "vat_on_delivery"]);
  });

  it("a later rise credits only the difference; the same total again makes nothing new", () => {
    const first = notes(must(projectBidDeliveryRefunded(facts())).documents);
    const second = notes(
      must(projectBidDeliveryRefunded(facts({ refundedPence: 4_000, priorCredits: first })))
        .documents,
    );
    expect(second.map((n) => n.totals.grossPence)).toEqual([2_500]);
    const again = notes(
      must(
        projectBidDeliveryRefunded(
          facts({ refundedPence: 4_000, priorCredits: [...first, ...second] }),
        ),
      ).documents,
    );
    expect(again).toEqual([]);
  });

  it("is idempotent: the same state gives the same credit note", () => {
    expect(projectBidDeliveryRefunded(facts())).toEqual(projectBidDeliveryRefunded(facts()));
  });

  it("never credits more than the quote was charged", () => {
    const [note] = notes(
      must(projectBidDeliveryRefunded(facts({ refundedPence: 9_999 }))).documents,
    );
    expect(note?.totals.grossPence).toBe(4_500);
    const full = notes(must(projectBidDeliveryRefunded(facts({ refundedPence: 4_500 }))).documents);
    expect(
      notes(
        must(projectBidDeliveryRefunded(facts({ refundedPence: 9_999, priorCredits: full })))
          .documents,
      ),
    ).toEqual([]);
  });

  it("is queued, not parked, once the accountant's delivery booking is set", () => {
    const projection = must(bidDeliveryRefundedPolicy(booked)(facts()));
    expect(projection.parked).toEqual([]);
    expect(notes(projection.documents)[0]?.lines[0]?.treatment).toBe("standard");
  });

  it("release refuses a parked delivery credit note while the booking is unset", () => {
    const projection = must(projectBidDeliveryRefunded(facts()));
    const [note] = notes(projection.documents);
    expect(
      resolveParked({ document: note as CreditNote, reason: "vat_on_delivery" }, projection),
    ).toMatchObject({ ok: false, refusal: { code: "unresolved" } });
  });
});

describe("courier refund total lowered (a refund taken back by the group's repair)", () => {
  const facts = (over: Partial<BidDeliveryRefundFacts> = {}): BidDeliveryRefundFacts => ({
    groupId: GROUP_ID,
    buyer: BUYER,
    quoteId: QUOTE_ID,
    chargedPence: 4_500,
    settledOn: "2026-11-13",
    refundedPence: 1_500,
    refundedOn: "2026-11-20",
    priorCredits: [],
    ...over,
  });
  const credited = (totals: number[]) => {
    const made: CreditNote[] = [];
    for (const total of totals) {
      made.push(
        ...notes(
          must(projectBidDeliveryRefunded(facts({ refundedPence: total, priorCredits: made })))
            .documents,
        ),
      );
    }
    return made;
  };

  it("cancels the newest credit notes never sent until the credit fits, then credits the rest again", () => {
    const made = credited([1_000, 3_000]);
    const projection = must(
      projectBidDeliveryRefunded(
        facts({ refundedPence: 2_000, priorCredits: made, priorStandings: ["issued", "waiting"] }),
      ),
    );
    expect(projection.cancel).toEqual([made[1]?.reference]);
    expect(notes(projection.documents).map((n) => n.totals.grossPence)).toEqual([1_000]);
    expect(notes(projection.documents)[0]?.reference).toBe(
      `LAX-BID-CN-${deliveryCreditSourceId(QUOTE_ID, 2_000)}`,
    );
  });

  it("holds an issued credit note above the total for a person, and makes nothing more", () => {
    const made = credited([3_000]);
    const projection = must(
      projectBidDeliveryRefunded(
        facts({ refundedPence: 1_500, priorCredits: made, priorStandings: ["issued"] }),
      ),
    );
    expect(projection.hold).toEqual([
      { reference: made[0]?.reference, reason: "refund_reversed_after_credit" },
    ]);
    expect(notes(projection.documents)).toEqual([]);
    expect(projection.cancel ?? []).toEqual([]);
  });

  it("waits while one is being sent, and refuses a credit above the total with no standings", () => {
    const made = credited([3_000]);
    expect(
      projectBidDeliveryRefunded(
        facts({ refundedPence: 1_500, priorCredits: made, priorStandings: ["in_flight"] }),
      ),
    ).toMatchObject({ ok: false, refusal: { code: "credit_in_flight" } });
    expect(
      projectBidDeliveryRefunded(facts({ refundedPence: 1_500, priorCredits: made })),
    ).toMatchObject({ ok: false, refusal: { code: "bad_facts" } });
  });

  it("holds again, as taken back, one already with a person for another reason (review N2)", () => {
    const made = credited([3_000]);
    const projection = must(
      projectBidDeliveryRefunded(
        facts({ refundedPence: 0, priorCredits: made, priorStandings: ["held_for_review"] }),
      ),
    );
    expect(projection.hold).toEqual([
      { reference: made[0]?.reference, reason: "refund_reversed_after_credit" },
    ]);
    expect(projection.cancel ?? []).toEqual([]);
    expect(notes(projection.documents)).toEqual([]);
  });

  it("property: after a lowering, what stays credited (never sent) is exactly the new total", () => {
    forAll(200, (rng) => {
      const totals = [int(rng, 1, 1_500), int(rng, 1_501, 3_000), int(rng, 3_001, 4_500)];
      const made = credited(totals);
      const lowered = int(rng, 0, 4_500);
      const projection = must(
        projectBidDeliveryRefunded(
          facts({
            refundedPence: lowered,
            priorCredits: made,
            priorStandings: made.map(() => "waiting" as const),
          }),
        ),
      );
      const kept = made.filter((n) => !(projection.cancel ?? []).includes(n.reference));
      const total = [...kept, ...notes(projection.documents)].reduce(
        (sum, n) => sum + n.totals.grossPence,
        0,
      );
      expect(total).toBe(Math.min(lowered, 4_500));
    });
  });
});

describe("refund taken back after its credit note was made (payment.refund_reversed)", () => {
  const reference = (n: number) => `LAX-BID-CN-0b6a7c1e-4444-4a5b-8c9d-00000000000${n}`;

  it("cancels one never sent, holds one issued (or already with a person, review N2) for a person, leaves one absent", () => {
    const projection = must(
      projectBidRefundReversed({
        reversed: [
          { reference: reference(1), standing: "waiting" },
          { reference: reference(2), standing: "issued" },
          { reference: reference(3), standing: "held_for_review" },
          { reference: reference(4), standing: "absent" },
        ],
      }),
    );
    expect(projection).toEqual({
      documents: [],
      cancel: [reference(1)],
      hold: [
        { reference: reference(2), reason: "refund_reversed_after_credit" },
        { reference: reference(3), reason: "refund_reversed_after_credit" },
      ],
    });
  });

  it("waits while one is being sent (tried again), and makes nothing when none was made", () => {
    expect(
      projectBidRefundReversed({ reversed: [{ reference: reference(1), standing: "in_flight" }] }),
    ).toMatchObject({ ok: false, refusal: { code: "credit_in_flight" } });
    expect(must(projectBidRefundReversed({ reversed: [] }))).toEqual({ documents: [] });
  });
});

describe("buyer default (flow 11)", () => {
  const facts = (over: Partial<BidBuyerDefaultFacts> = {}): BidBuyerDefaultFacts => ({
    invoice: invoiceFacts(),
    defaultedOn: "2026-11-30",
    inBooks: "issued",
    priorCredits: [],
    ...over,
  });

  it("the accountant's answer is not set here", () => {
    expect(BID_DEFAULT_ACCOUNTING_TREATMENT).toBeNull();
  });

  it("an invoice never sent is cancelled in the books, and nothing is made", () => {
    expect(must(projectBidBuyerDefault(facts({ inBooks: "waiting" })))).toEqual({
      documents: [],
      cancel: [`LAX-BID-INV-${INVOICE_ID}`],
    });
    expect(must(projectBidBuyerDefault(facts({ inBooks: "absent" })))).toEqual({ documents: [] });
  });

  it("an invoice in flight or held for a person is not decided here", () => {
    expect(projectBidBuyerDefault(facts({ inBooks: "in_flight" }))).toMatchObject({
      ok: false,
      refusal: { code: "invoice_in_flight" },
    });
    expect(projectBidBuyerDefault(facts({ inBooks: "held_for_review" }))).toMatchObject({
      ok: false,
      refusal: { code: "invoice_held_for_review" },
    });
  });

  it("an issued invoice gets a full credit note, parked until the treatment is decided", () => {
    const projection = must(projectBidBuyerDefault(facts()));
    const invoice = projection.documents[1] as Invoice;
    const [note] = notes(projection.documents);
    expect(note?.reference).toBe(`LAX-BID-CN-dft-${INVOICE_ID}`);
    expect(note?.totals).toEqual(invoice.totals);
    expect(note?.refund).toBeUndefined();
    expect(planCreditNoteRefund(note as CreditNote)).toMatchObject({
      ok: false,
      refusal: { code: "no_money_back" },
    });
    expect(projection.parked).toEqual([
      { reference: note?.reference, reason: "buyer_default_treatment" },
    ]);
  });

  it("credits only what earlier credit notes left", () => {
    const refundedNotes = notes(
      must(
        projectBidPaymentRefunded({
          invoice: invoiceFacts(),
          paidPence: 154_320,
          refunds: [{ refundId: "r1", amountPence: 20_000, refundedOn: "2026-11-20" }],
        }),
      ).documents,
    );
    const [note] = notes(
      must(projectBidBuyerDefault(facts({ priorCredits: refundedNotes }))).documents,
    );
    expect(note?.totals.grossPence).toBe(154_320 - 20_000);
  });

  it("'credit_note' queues it; release then moves a parked one on, unchanged", () => {
    const parked = must(projectBidBuyerDefault(facts()));
    const [note] = notes(parked.documents);
    const decided = must(bidBuyerDefaultPolicy("credit_note")(facts()));
    expect(decided.parked).toEqual([]);
    expect(
      resolveParked({ document: note as CreditNote, reason: "buyer_default_treatment" }, decided),
    ).toEqual({ ok: true, value: { document: note, rebuilt: false } });
  });

  it("'void' keeps it parked: voiding in the books is not built", () => {
    const [note] = notes(must(projectBidBuyerDefault(facts())).documents);
    expect(
      resolveParked(
        { document: note as CreditNote, reason: "buyer_default_treatment" },
        must(bidBuyerDefaultPolicy("void")(facts())),
      ),
    ).toMatchObject({ ok: false, refusal: { code: "unresolved" } });
  });

  it("unset: release refuses", () => {
    const projection = must(projectBidBuyerDefault(facts()));
    const [note] = notes(projection.documents);
    expect(
      resolveParked(
        { document: note as CreditNote, reason: "buyer_default_treatment" },
        projection,
      ),
    ).toMatchObject({ ok: false, refusal: { code: "unresolved" } });
  });
});
