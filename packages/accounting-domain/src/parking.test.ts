import { describe, expect, it } from "vitest";
import { canTryAgain, queueTabFor } from "./attention.js";
import { documentsAwaited } from "./dependencies.js";
import { buildContact, buildInvoice, buildPayment } from "./document.js";
import { cancel, parkedRecord, parseRecord, requeue } from "./lifecycle.js";
import { PARK_REASONS, isParkedReason, parkReasonOf, parkedReasonCode } from "./parking.js";

const REF = "LAX-BID-INV-dlv-0b6a7c1e";

describe("parked documents", () => {
  it("store a fixed reason code that reads back to its reason", () => {
    for (const reason of PARK_REASONS) {
      expect(parkReasonOf(parkedReasonCode(reason))).toBe(reason);
      expect(isParkedReason(parkedReasonCode(reason))).toBe(true);
    }
    expect(parkReasonOf("accounting_parked_something_else")).toBeNull();
    expect(parkReasonOf("zoho_books_writes_disabled")).toBeNull();
    expect(parkReasonOf(null)).toBeNull();
  });

  it("start in Needs a person with nothing owed and nothing in the provider", () => {
    const record = parkedRecord("invoice", REF, "vat_on_delivery");
    expect(record).toEqual({
      kind: "invoice",
      reference: REF,
      attempts: 0,
      status: "needs_review",
      lookup: "clear",
      issued: null,
      mismatch: null,
      reason: "accounting_parked_vat_on_delivery",
    });
    expect(queueTabFor(record)).toBe("needs_person");
    expect(parseRecord(record, 0)).toEqual({ ok: true, value: record });
  });

  it("are never requeued or tried again by hand, only cancelled", () => {
    for (const reason of PARK_REASONS) {
      const record = parkedRecord("payment", "LAX-BID-PAY-grp-0b6a7c1e", reason);
      expect(requeue(record)).toMatchObject({ ok: false, refusal: { code: "parked" } });
      expect(canTryAgain(record)).toBe(false);
      expect(cancel(record)).toMatchObject({ ok: true, value: { status: "cancelled" } });
    }
  });

  it("a review that is not parked can still be requeued", () => {
    const record = {
      ...parkedRecord("invoice", REF, "vat_on_delivery"),
      reason: "a person said so",
    };
    expect(requeue(record).ok).toBe(true);
  });
});

describe("documentsAwaited", () => {
  it("a payment waits for each invoice it is applied to; a contact waits for nothing", () => {
    const contact = buildContact({ product: "bid", sourceId: "b1", name: "Ada", email: null });
    if (!contact.ok) throw new Error(contact.refusal.message);
    const payment = buildPayment({
      product: "bid",
      sourceId: "grp-1",
      contactReference: contact.value.reference,
      receivedOn: "2026-11-14",
      amountPence: 300,
      allocations: [
        { invoiceReference: "LAX-BID-INV-b", amountPence: 200 },
        { invoiceReference: "LAX-BID-INV-a", amountPence: 100 },
      ],
    });
    if (!payment.ok) throw new Error(payment.refusal.message);
    expect(documentsAwaited(payment.value)).toEqual(["LAX-BID-INV-a", "LAX-BID-INV-b"]);
    expect(documentsAwaited(contact.value)).toEqual([]);
  });

  it("an invoice waits for its contact, whatever order they were stored in", () => {
    const contact = buildContact({ product: "bid", sourceId: "b1", name: "Ada", email: null });
    if (!contact.ok) throw new Error(contact.refusal.message);
    const invoice = buildInvoice({
      product: "bid",
      sourceId: "i1",
      contactReference: contact.value.reference,
      issuedOn: "2026-11-14",
      dueOn: "2026-11-14",
      lines: [
        {
          description: "Hammer price",
          quantity: 1,
          unitNetPence: 10_000,
          treatment: "margin_scheme",
          role: "goods",
        },
      ],
    });
    if (!invoice.ok) throw new Error(invoice.refusal.message);
    expect(documentsAwaited(invoice.value)).toEqual([contact.value.reference]);
  });
});
