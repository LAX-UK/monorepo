import { describe, expect, it } from "vitest";
import type { Invoice, Payment } from "../document.js";
import { forAll, int } from "../testing/generate.js";
import {
  type BidGroupMemberFacts,
  type BidPaymentGroupFacts,
  DELIVERY_BOOKING,
  projectBidPaymentCaptured,
  projectBidPaymentGroupSettled,
} from "./bid-payments.js";
import { type BidInvoiceFacts, projectBidInvoiceRaised } from "./bid.js";
import { parkReasonFor } from "./projection.js";

const BUYER_ID = "0b6a7c1e-2222-4a5b-8c9d-000000000002";
const OTHER_BUYER_ID = "0b6a7c1e-2222-4a5b-8c9d-0000000000ff";
const PAYMENT_ID = "0b6a7c1e-3333-4a5b-8c9d-000000000003";
const GROUP_ID = "0b6a7c1e-5555-4a5b-8c9d-000000000005";
const DELIVERY_ID = "0b6a7c1e-6666-4a5b-8c9d-000000000006";
const BUYER = { legalEntityId: BUYER_ID, name: "Ada Collector", email: "ada@example.com" };

const invoiceId = (n: number) => `0b6a7c1e-1111-4a5b-8c9d-${String(n).padStart(12, "0")}`;
const paymentId = (n: number) => `0b6a7c1e-3333-4a5b-8c9d-${String(n).padStart(12, "0")}`;

const invoiceFacts = (n = 1, hammerPence = 123_456, premiumPence = 30_864): BidInvoiceFacts => ({
  invoiceId: invoiceId(n),
  buyer: BUYER,
  raisedOn: "2026-11-12",
  dueOn: "2026-11-26",
  lines: [
    { kind: "hammer", label: "Hammer price", amountPence: hammerPence },
    { kind: "buyers_premium", label: "Buyer's premium (25%)", amountPence: premiumPence },
  ],
});

function must<T>(r: { ok: true; value: T } | { ok: false; refusal: { message: string } }): T {
  if (!r.ok) throw new Error(r.refusal.message);
  return r.value;
}

describe("Bid payment captured (card, or a bank transfer fully funded)", () => {
  const captured = (amountPence: number, over: Record<string, unknown> = {}) => ({
    paymentId: PAYMENT_ID,
    invoice: invoiceFacts(),
    amountPence,
    currency: "GBP",
    capturedOn: "2026-11-13",
    ...over,
  });

  it("projects contact, invoice and the payment applied to that invoice", () => {
    const projection = must(projectBidPaymentCaptured(captured(154_320)));
    expect(projection.documents.map((d) => d.kind)).toEqual(["contact", "invoice", "payment"]);
    expect(projection.documents[2] as Payment).toMatchObject({
      reference: `LAX-BID-PAY-${PAYMENT_ID}`,
      receivedOn: "2026-11-13",
      amountPence: 154_320,
      currency: "GBP",
      allocations: [{ invoiceReference: `LAX-BID-INV-${invoiceId(1)}`, amountPence: 154_320 }],
      unallocatedPence: 0,
    });
    expect(projection.parked ?? []).toEqual([]);
  });

  it("gives the same contact and invoice as the invoice flow, so registering them is a replay", () => {
    const raised = must(projectBidInvoiceRaised(invoiceFacts())).documents;
    const paid = must(projectBidPaymentCaptured(captured(154_320))).documents;
    expect(paid.slice(0, 2)).toEqual(raised);
  });

  it("applies a part payment in full to the invoice", () => {
    const payment = must(projectBidPaymentCaptured(captured(100_000))).documents[2] as Payment;
    expect(payment.allocations).toEqual([
      { invoiceReference: `LAX-BID-INV-${invoiceId(1)}`, amountPence: 100_000 },
    ]);
  });

  it("refuses a payment for more than the invoice, even by 1p; a remainder is never spread", () => {
    expect(projectBidPaymentCaptured(captured(154_321))).toMatchObject({
      ok: false,
      refusal: { code: "payment_exceeds_invoice" },
    });
  });

  it("refuses a payment of nothing or of part of a penny", () => {
    for (const amount of [0, -1, 10.5]) {
      expect(projectBidPaymentCaptured(captured(amount)).ok).toBe(false);
    }
  });

  it("refuses money in any currency but pounds", () => {
    for (const currency of ["EUR", "gbp", ""]) {
      expect(projectBidPaymentCaptured(captured(154_320, { currency }))).toMatchObject({
        ok: false,
        refusal: { code: "not_in_pounds" },
      });
    }
  });

  it("parks a payment for a cancelled invoice and does not book the invoice again", () => {
    const projection = must(
      projectBidPaymentCaptured(
        captured(154_320, {
          invoice: { invoiceId: invoiceId(1), buyer: BUYER, cancelled: true },
        }),
      ),
    );
    expect(projection.documents.map((d) => d.kind)).toEqual(["contact", "payment"]);
    const payment = projection.documents[1] as Payment;
    expect(payment.allocations).toEqual([
      { invoiceReference: `LAX-BID-INV-${invoiceId(1)}`, amountPence: 154_320 },
    ]);
    expect(projection.parked).toEqual([
      { reference: payment.reference, reason: "invoice_cancelled" },
    ]);
  });
});

describe("Pay several settled", () => {
  const member = (n: number, amountPence: number, invoice?: BidInvoiceFacts) => ({
    paymentId: paymentId(n),
    amountPence,
    invoice: invoice ?? invoiceFacts(n),
  });
  const group = (over: Partial<BidPaymentGroupFacts> = {}): BidPaymentGroupFacts => ({
    groupId: GROUP_ID,
    buyer: BUYER,
    currency: "GBP",
    totalPence: 154_320 * 2,
    settledOn: "2026-11-14",
    members: [member(1, 154_320), member(2, 154_320)],
    deliveries: [],
    ...over,
  });
  const paymentOf = (documents: readonly { kind: string }[]) =>
    documents.find((d) => d.kind === "payment") as Payment;

  it("books ONE payment applied to each invoice by its own payment row's amount", () => {
    const projection = must(projectBidPaymentGroupSettled(group()));
    expect(projection.documents.map((d) => d.kind)).toEqual([
      "contact",
      "invoice",
      "invoice",
      "payment",
    ]);
    const payment = paymentOf(projection.documents);
    expect(payment).toMatchObject({
      reference: `LAX-BID-PAY-grp-${GROUP_ID}`,
      receivedOn: "2026-11-14",
      amountPence: 308_640,
      unallocatedPence: 0,
    });
    expect(payment.allocations).toEqual([
      { invoiceReference: `LAX-BID-INV-${invoiceId(1)}`, amountPence: 154_320 },
      { invoiceReference: `LAX-BID-INV-${invoiceId(2)}`, amountPence: 154_320 },
    ]);
    expect(projection.parked).toEqual([]);
  });

  it("gives each invoice exactly as its own flow does, so registering them is a replay", () => {
    const projection = must(projectBidPaymentGroupSettled(group()));
    const raised = must(projectBidInvoiceRaised(invoiceFacts(2))).documents[1];
    expect(projection.documents[2]).toEqual(raised);
  });

  it("keeps the odd penny where the rows put it: £33.33 + £33.33 + £33.34 is £100.00", () => {
    const facts = group({
      totalPence: 10_000,
      members: [
        member(1, 3_333, invoiceFacts(1, 3_333, 0)),
        member(2, 3_333, invoiceFacts(2, 3_333, 0)),
        member(3, 3_334, invoiceFacts(3, 3_334, 0)),
      ],
    });
    const payment = paymentOf(must(projectBidPaymentGroupSettled(facts)).documents);
    expect(payment.allocations.map((a) => a.amountPence)).toEqual([3_333, 3_333, 3_334]);
  });

  it("refuses a total 1p over or under the allocations; nothing is absorbed", () => {
    for (const totalPence of [308_639, 308_641]) {
      expect(projectBidPaymentGroupSettled(group({ totalPence }))).toMatchObject({
        ok: false,
        refusal: { code: "allocation_mismatch" },
      });
    }
  });

  it("allocations always equal the payment exactly, for many lots and odd amounts", () => {
    forAll(200, (rng) => {
      const count = int(rng, 1, 40);
      const members: BidGroupMemberFacts[] = [];
      let total = 0;
      for (let n = 1; n <= count; n += 1) {
        const hammer = int(rng, 1, 5_000_000);
        const premium = int(rng, 0, 1_250_000);
        const paid = int(rng, 1, hammer + premium);
        members.push(member(n, paid, invoiceFacts(n, hammer, premium)));
        total += paid;
      }
      const deliveries =
        rng() < 0.5 ? [{ quoteId: DELIVERY_ID, amountPence: int(rng, 1, 99_999) }] : [];
      total += deliveries.reduce((sum, d) => sum + d.amountPence, 0);
      const payment = paymentOf(
        must(projectBidPaymentGroupSettled(group({ members, deliveries, totalPence: total })))
          .documents,
      );
      const allocated = payment.allocations.reduce((sum, a) => sum + a.amountPence, 0);
      expect(allocated).toBe(total);
      expect(payment.amountPence).toBe(total);
      expect(payment.unallocatedPence).toBe(0);
      expect(payment.allocations).toHaveLength(count + deliveries.length);
      for (const drift of [-1, 1]) {
        const off = group({ members, deliveries, totalPence: total + drift });
        expect(projectBidPaymentGroupSettled(off)).toMatchObject({
          ok: false,
          refusal: { code: "allocation_mismatch" },
        });
      }
    });
  });

  it("refuses a member paid more than its invoice", () => {
    const facts = group({ members: [member(1, 154_321), member(2, 154_319)] });
    expect(projectBidPaymentGroupSettled(facts)).toMatchObject({
      ok: false,
      refusal: { code: "payment_exceeds_invoice" },
    });
  });

  it("refuses an invoice of another buyer account", () => {
    const other = { ...invoiceFacts(2), buyer: { ...BUYER, legalEntityId: OTHER_BUYER_ID } };
    expect(
      projectBidPaymentGroupSettled(
        group({ members: [member(1, 154_320), member(2, 154_320, other)] }),
      ),
    ).toMatchObject({
      ok: false,
      refusal: { code: "buyer_mismatch" },
    });
  });

  it("refuses the same invoice twice, a group of nothing and money not in pounds", () => {
    expect(
      projectBidPaymentGroupSettled(group({ members: [member(1, 154_320), member(1, 154_320)] }))
        .ok,
    ).toBe(false);
    expect(projectBidPaymentGroupSettled(group({ members: [], totalPence: 1 }))).toMatchObject({
      ok: false,
      refusal: { code: "bad_facts" },
    });
    expect(projectBidPaymentGroupSettled(group({ currency: "USD" }))).toMatchObject({
      ok: false,
      refusal: { code: "not_in_pounds" },
    });
  });

  describe("a courier quote paid with the lots", () => {
    const withDelivery = group({
      totalPence: 154_320 * 2 + 4_500,
      deliveries: [{ quoteId: DELIVERY_ID, amountPence: 4_500 }],
    });

    it("has no booking until the accountant answers (the extension point)", () => {
      expect(DELIVERY_BOOKING).toBeNull();
    });

    it("builds the delivery invoice and its allocation inside the one payment", () => {
      const projection = must(projectBidPaymentGroupSettled(withDelivery));
      const delivery = projection.documents.find(
        (d) => d.reference === `LAX-BID-INV-dlv-${DELIVERY_ID}`,
      ) as Invoice;
      expect(delivery.totals.grossPence).toBe(4_500);
      expect(delivery.lines.map((l) => l.role)).toEqual(["delivery"]);
      const payment = paymentOf(projection.documents);
      expect(payment.amountPence).toBe(313_140);
      expect(payment.allocations).toContainEqual({
        invoiceReference: delivery.reference,
        amountPence: 4_500,
      });
    });

    it("parks the delivery invoice and the payment, waiting for the accountant; the lots still go", () => {
      const projection = must(projectBidPaymentGroupSettled(withDelivery));
      const payment = paymentOf(projection.documents);
      expect(parkReasonFor(projection, `LAX-BID-INV-dlv-${DELIVERY_ID}`)).toBe("vat_on_delivery");
      expect(parkReasonFor(projection, payment.reference)).toBe("vat_on_delivery");
      expect(parkReasonFor(projection, `LAX-BID-INV-${invoiceId(1)}`)).toBeNull();
      expect(parkReasonFor(projection, `LAX-BID-CON-${BUYER_ID}`)).toBeNull();
    });

    it("refuses a delivery charge of nothing", () => {
      const facts = group({ deliveries: [{ quoteId: DELIVERY_ID, amountPence: 0 }] });
      expect(projectBidPaymentGroupSettled(facts).ok).toBe(false);
    });
  });

  it("parks the payment when an invoice it settles was cancelled; the others are still booked", () => {
    const cancelled = { invoiceId: invoiceId(2), buyer: BUYER, cancelled: true as const };
    const projection = must(
      projectBidPaymentGroupSettled(
        group({
          totalPence: 154_320 * 2 + 4_500,
          members: [
            member(1, 154_320),
            { paymentId: paymentId(2), amountPence: 154_320, invoice: cancelled },
          ],
          deliveries: [{ quoteId: DELIVERY_ID, amountPence: 4_500 }],
        }),
      ),
    );
    const payment = paymentOf(projection.documents);
    expect(
      projection.documents.filter((d) => d.kind === "invoice").map((d) => d.reference),
    ).toEqual([`LAX-BID-INV-${invoiceId(1)}`, `LAX-BID-INV-dlv-${DELIVERY_ID}`]);
    expect(payment.allocations).toContainEqual({
      invoiceReference: `LAX-BID-INV-${invoiceId(2)}`,
      amountPence: 154_320,
    });
    expect(parkReasonFor(projection, payment.reference)).toBe("invoice_cancelled");
  });

  it("is idempotent: the same facts always give the same documents", () => {
    expect(projectBidPaymentGroupSettled(group())).toEqual(projectBidPaymentGroupSettled(group()));
  });
});
