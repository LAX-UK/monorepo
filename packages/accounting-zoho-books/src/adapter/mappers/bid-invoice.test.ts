import { type Invoice, projectBidInvoiceRaised } from "@auction/accounting-domain";
import { describe, expect, it } from "vitest";
import { testOrgConfigs } from "../../testing/index.js";
import { penceToPounds } from "../money-format.js";
import { invoiceBody } from "./invoice.js";

const INVOICE_ID = "0b6a4f8e-3c41-4c55-9d7e-1f0e2a3b4c5d";
const BANDS = "Buyer's premium (25% to £100,000, then 20%)";

/** A raised Bid invoice, through the projection policy, to the body Books would be sent. */
function bidInvoice(lines: { kind: string; label: string; amountPence: number }[]): Invoice {
  const projected = projectBidInvoiceRaised({
    invoiceId: INVOICE_ID,
    buyer: {
      legalEntityId: "5c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f",
      name: "Test Buyer",
      email: null,
    },
    raisedOn: "2026-11-12",
    dueOn: "2026-11-26",
    lines,
  });
  if (!projected.ok) throw new Error(projected.refusal.code);
  return projected.value.documents[1] as Invoice;
}

describe("Bid invoice to the Books invoice body", () => {
  const org = testOrgConfigs().london_auction_xchange;
  if (!org) throw new Error("the fixtures configure the Bid organisation");

  it("sends the frozen lines as they were raised: hammer, then the premium under its bands label", () => {
    const invoice = bidInvoice([
      { kind: "hammer", label: "Hammer price", amountPence: 12_000_000 },
      { kind: "buyers_premium", label: BANDS, amountPence: 2_900_000 },
    ]);
    const body = invoiceBody(invoice, "customer-1", org);
    if (!body.ok) throw new Error(body.refusal.code);
    expect(body.value.reference_number).toBe(`LAX-BID-INV-${INVOICE_ID}`);
    expect(body.value.date).toBe("2026-11-12");
    expect(body.value.due_date).toBe("2026-11-26");
    expect(body.value.is_inclusive_tax).toBe(false);
    expect(body.value.line_items.map((l) => [l.description, l.rate, l.quantity])).toEqual([
      ["Hammer price", penceToPounds(12_000_000), 1],
      [BANDS, penceToPounds(2_900_000), 1],
    ]);
    // Margin scheme: Books is asked to add no VAT, so its total can only equal ours.
    expect(invoice.totals).toEqual({ netPence: 14_900_000, vatPence: 0, grossPence: 14_900_000 });
  });

  it("carries the LAX reference in the organisation's reference field", () => {
    const invoice = bidInvoice([{ kind: "hammer", label: "Hammer price", amountPence: 5_000 }]);
    const body = invoiceBody(invoice, "customer-1", org);
    if (!body.ok) throw new Error(body.refusal.code);
    expect(body.value.custom_fields).toEqual([
      { customfield_id: org.laxReferenceField.fieldId, value: invoice.reference },
    ]);
  });
});
