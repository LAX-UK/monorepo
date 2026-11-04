import { describe, expect, it } from "vitest";
import { INTEGRATION_PAYLOAD_FIELDS, maskIntegrationPayload } from "./integration-payload-mask.js";

const captured = {
  paymentId: "5f1c2d3e-aaaa-4bbb-8ccc-1234567890ab",
  lotId: "lot-14",
  userId: "user-9",
  amountCents: 900_000,
  capturedAt: "2026-11-01T07:44:00.000Z",
  via: "stripe_checkout_webhook",
  stripeCustomerId: "cus_9ZzTop",
  buyerName: "Lena Fischer",
  buyerEmail: "lena@north.com",
  billingAddress: { line1: "1 Mill Lane", postcode: "N1 9AA" },
  phone: "+44 7700 900123",
  internalNote: "Called the buyer, card declined twice",
};

describe("maskIntegrationPayload", () => {
  it("shows only listed fields, with personal ones partly hidden", () => {
    const { entries } = maskIntegrationPayload("payment.captured", captured);
    expect(entries).toEqual(
      expect.arrayContaining([
        { label: "Amount", value: "£9,000.00", masked: false },
        { label: "Buyer", value: "L. F•••", masked: true },
        { label: "Buyer email", value: "l•••••@n•••••.com", masked: true },
        { label: "Lot ID", value: "lot-14", masked: false },
      ]),
    );
  });

  it("leaks nothing that is not listed, however it is nested or named", () => {
    const { entries, omitted } = maskIntegrationPayload("payment.captured", captured);
    const shown = JSON.stringify(entries);
    for (const secret of [
      "lena@north.com",
      "Lena Fischer",
      "1 Mill Lane",
      "N1 9AA",
      "7700 900123",
      "card declined",
      "cus_9ZzTop",
    ]) {
      expect(shown).not.toContain(secret);
    }
    // billingAddress.line1, billingAddress.postcode, phone, internalNote, stripeCustomerId, userId
    expect(omitted).toBe(6);
  });

  it("shows nothing for an event type nobody has listed, and counts every value as left out", () => {
    const result = maskIntegrationPayload("some.new_event", { a: 1, b: "two", c: { d: "three" } });
    expect(result.entries).toEqual([]);
    expect(result.omitted).toBe(3);
  });

  it("does not count empty values as left out", () => {
    expect(maskIntegrationPayload("some.new_event", { a: null, b: "" }).omitted).toBe(0);
  });

  it("reads nested listed paths", () => {
    const { entries, omitted } = maskIntegrationPayload("webhook.stripe", {
      id: "evt_1",
      type: "checkout.session.completed",
      data: { object: { id: "cs_1", amount_total: 12_345, customer_email: "a@b.com" } },
    });
    expect(entries.map((entry) => entry.label)).toEqual([
      "Event ID",
      "Event type",
      "Object ID",
      "Amount",
    ]);
    expect(JSON.stringify(entries)).not.toContain("a@b.com");
    expect(omitted).toBe(1);
  });

  it("formats decimal amounts in pounds", () => {
    const { entries } = maskIntegrationPayload("payout.paid", {
      grossAmount: "1500.00",
      netAmount: "1350",
    });
    expect(entries).toEqual([
      { label: "Gross amount", value: "£1,500.00", masked: false },
      { label: "Net amount", value: "£1,350.00", masked: false },
    ]);
  });

  it("scrubs free text in text fields", () => {
    const { entries } = maskIntegrationPayload("lot.ended", { outcome: "mail lena@north.com" });
    expect(entries[0]?.value).not.toContain("lena@north.com");
  });

  it("lists no field that could carry a credential or a free-text body", () => {
    const risky =
      /(password|secret|token|authorization|cookie|signature|body|html|message|address|iban)/i;
    for (const [event, fields] of Object.entries(INTEGRATION_PAYLOAD_FIELDS)) {
      for (const field of fields) {
        expect(risky.test(field.path), `${event}: ${field.path}`).toBe(false);
      }
    }
  });
});
