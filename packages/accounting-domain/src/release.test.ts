import { describe, expect, it } from "vitest";
import type { Invoice } from "./document.js";
import { newRecord, park, parkedRecord, release, requeue } from "./lifecycle.js";
import {
  type BidPaymentFacts,
  type BidPaymentGroupFacts,
  bidPaymentGroupSettledPolicy,
  projectBidPaymentCaptured,
  projectBidPaymentGroupSettled,
} from "./projection/bid-payments.js";
import type { LineBooking } from "./projection/bid.js";
import { parkReasonFor } from "./projection/projection.js";
import { resolveParked, sameDocument } from "./release.js";

const BUYER = {
  legalEntityId: "0b6a7c1e-2222-4a5b-8c9d-000000000002",
  name: "Ada Collector",
  email: null,
};
const INVOICE_ID = "0b6a7c1e-1111-4a5b-8c9d-000000000001";
const GROUP_ID = "0b6a7c1e-5555-4a5b-8c9d-000000000005";
const QUOTE_ID = "0b6a7c1e-6666-4a5b-8c9d-000000000006";
const PAYMENT_ID = "0b6a7c1e-3333-4a5b-8c9d-000000000003";
/** A booking the accountant might give that keeps what was charged (no VAT added on top). */
const ZERO_RATED: LineBooking = { role: "delivery", treatment: "zero" };
const STANDARD: LineBooking = { role: "delivery", treatment: "standard" };

const raised = {
  invoiceId: INVOICE_ID,
  buyer: BUYER,
  raisedOn: "2026-11-12",
  dueOn: "2026-11-26",
  lines: [{ kind: "hammer", label: "Hammer price", amountPence: 10_000 }],
};
const group: BidPaymentGroupFacts = {
  groupId: GROUP_ID,
  buyer: BUYER,
  currency: "GBP",
  totalPence: 11_000,
  settledOn: "2026-11-14",
  members: [{ paymentId: PAYMENT_ID, amountPence: 10_000, invoice: raised }],
  deliveries: [{ quoteId: QUOTE_ID, amountPence: 1_000 }],
};

function must<T>(r: { ok: true; value: T } | { ok: false; refusal: { message: string } }): T {
  if (!r.ok) throw new Error(r.refusal.message);
  return r.value;
}

const parkedNow = must(projectBidPaymentGroupSettled(group));
const delivery = parkedNow.documents.find((d) => d.reference.includes("dlv-")) as Invoice;
const groupPayment = parkedNow.documents.find((d) => d.kind === "payment");
if (!groupPayment) throw new Error("no payment");

describe("release (life cycle)", () => {
  it("queues a parked document again, attempts kept, under the same reference", () => {
    const record = parkedRecord("invoice", delivery.reference, "vat_on_delivery");
    expect(release(record)).toEqual({
      ok: true,
      value: { kind: "invoice", reference: delivery.reference, attempts: 0, status: "pending" },
    });
  });

  it("refuses anything that is not parked; requeue still refuses a parked one", () => {
    expect(release(newRecord("invoice", delivery.reference))).toMatchObject({
      ok: false,
      refusal: { code: "not_parked" },
    });
    const cleared = {
      ...parkedRecord("invoice", delivery.reference, "vat_on_delivery"),
      reason: "zoho_books_contact_missing",
    };
    expect(release(cleared)).toMatchObject({ ok: false, refusal: { code: "not_parked" } });
    expect(requeue(parkedRecord("invoice", delivery.reference, "vat_on_delivery"))).toMatchObject({
      ok: false,
      refusal: { code: "parked" },
    });
  });

  it("parks only a queued document", () => {
    const parked = must(park(newRecord("payment", groupPayment.reference), "invoice_cancelled"));
    expect(parked).toMatchObject({
      status: "needs_review",
      lookup: "clear",
      issued: null,
      reason: "accounting_parked_invoice_cancelled",
    });
    expect(park(parked, "invoice_cancelled")).toMatchObject({ ok: false });
  });
});

describe("resolveParked: released only when the stored rows no longer park it", () => {
  it("refuses the delivery invoice and its payment while VAT on delivery is not settled", () => {
    for (const document of [delivery, groupPayment]) {
      expect(resolveParked({ document, reason: "vat_on_delivery" }, parkedNow)).toMatchObject({
        ok: false,
        refusal: { code: "unresolved" },
      });
    }
  });

  it("with the booking set, replaces the draft with the rebuilt invoice; what was charged is kept", () => {
    const booked = must(bidPaymentGroupSettledPolicy(ZERO_RATED)(group));
    const released = must(resolveParked({ document: delivery, reason: "vat_on_delivery" }, booked));
    expect(released.rebuilt).toBe(true);
    expect(released.document.reference).toBe(delivery.reference);
    expect((released.document as Invoice).lines[0]).toMatchObject({ treatment: "zero" });
    expect((released.document as Invoice).totals.grossPence).toBe(1_000);
    // The payment comes out exactly as it was parked.
    expect(
      must(resolveParked({ document: groupPayment, reason: "vat_on_delivery" }, booked)),
    ).toEqual({ document: groupPayment, rebuilt: false });
  });

  it("refuses a rebuilt delivery invoice whose total moved (the payment is applied to the penny)", () => {
    const booked = must(bidPaymentGroupSettledPolicy(STANDARD)(group));
    expect(resolveParked({ document: delivery, reason: "vat_on_delivery" }, booked)).toMatchObject({
      ok: false,
      refusal: { code: "document_changed" },
    });
  });

  it("refuses a payment whose stored rows changed, and one the rows no longer make", () => {
    const booked = must(
      bidPaymentGroupSettledPolicy(ZERO_RATED)({
        ...group,
        settledOn: "2026-11-15",
      }),
    );
    expect(
      resolveParked({ document: groupPayment, reason: "vat_on_delivery" }, booked),
    ).toMatchObject({ ok: false, refusal: { code: "document_changed" } });
    expect(
      resolveParked({ document: groupPayment, reason: "vat_on_delivery" }, { documents: [] }),
    ).toMatchObject({ ok: false, refusal: { code: "not_rebuilt" } });
  });

  it("a payment for a cancelled invoice: refused while voided, released once reinstated", () => {
    const captured = (cancelled: boolean): BidPaymentFacts => ({
      paymentId: PAYMENT_ID,
      invoice: cancelled ? { invoiceId: INVOICE_ID, buyer: BUYER, cancelled: true } : raised,
      amountPence: 10_000,
      currency: "GBP",
      capturedOn: "2026-11-13",
    });
    const voided = must(projectBidPaymentCaptured(captured(true)));
    const payment = voided.documents.find((d) => d.kind === "payment");
    if (!payment) throw new Error("no payment");
    expect(parkReasonFor(voided, payment.reference)).toBe("invoice_cancelled");
    expect(resolveParked({ document: payment, reason: "invoice_cancelled" }, voided)).toMatchObject(
      { ok: false, refusal: { code: "unresolved" } },
    );
    const reinstated = must(projectBidPaymentCaptured(captured(false)));
    expect(
      must(resolveParked({ document: payment, reason: "invoice_cancelled" }, reinstated)),
    ).toEqual({ document: payment, rebuilt: false });
  });
});

describe("sameDocument", () => {
  it("compares plain data whatever the key order", () => {
    expect(sameDocument({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 })).toBe(true);
    expect(sameDocument({ a: 1 }, { a: 2 })).toBe(false);
    expect(sameDocument([1, 2], [2, 1])).toBe(false);
    expect(sameDocument({ a: 1, b: undefined }, { a: 1 })).toBe(true);
  });
});
