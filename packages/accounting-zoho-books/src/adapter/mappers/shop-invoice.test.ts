import {
  type Invoice,
  type ShopOrderPaidFacts,
  projectShopOrderPaid,
} from "@auction/accounting-domain";
import { describe, expect, it } from "vitest";
import { SHOP_TAX_IDS, testOrgConfigs } from "../../testing/index.js";
import { invoiceBody, invoiceQuery } from "./invoice.js";

const ORDER_ID = "5b6a7c1e-1111-4a5b-8c9d-000000000001";

function shopInvoice(over: Partial<ShopOrderPaidFacts> = {}): Invoice {
  const projected = projectShopOrderPaid({
    orderId: ORDER_ID,
    invoiceNumber: "LAX-INV-000124",
    buyer: { partyId: "5b6a7c1e-2222-4a5b-8c9d-000000000002", name: "Test Buyer", email: null },
    paidOn: "2026-11-12",
    totalPence: 59_500,
    lines: [
      {
        id: "a",
        kind: "goods",
        label: "Harbour at dusk · Edition 7 of 24",
        grossPence: 45_000,
        vatTreatment: null,
        vatPence: null,
      },
      {
        id: "b",
        kind: "framing",
        label: "Framing: Natural oak",
        grossPence: 12_000,
        vatTreatment: null,
        vatPence: null,
      },
    ],
    delivery: { scope: "uk", label: "UK insured delivery", grossPence: 2_500, vatPence: null },
    ...over,
  });
  if (!projected.ok) throw new Error(projected.refusal.code);
  return projected.value.documents[1] as Invoice;
}

describe("Shop invoice to the Books invoice body", () => {
  const org = testOrgConfigs().london_art_exchange;
  if (!org) throw new Error("the fixtures configure the Shop organisation");

  it("sends the Shop's number with automatic numbering off, and names no number series", () => {
    const invoice = shopInvoice();
    const body = invoiceBody(invoice, "customer-1", org);
    if (!body.ok) throw new Error(body.refusal.code);
    expect(body.value.invoice_number).toBe("LAX-INV-000124");
    expect(body.value.autonumbergenerationgroup_id).toBeUndefined();
    expect(invoiceQuery(invoice)).toEqual({ ignore_auto_number_generation: "true" });
  });

  it("sends each stored price as charged (VAT-inclusive), goods, framing, then UK delivery", () => {
    const body = invoiceBody(shopInvoice(), "customer-1", org);
    if (!body.ok) throw new Error(body.refusal.code);
    expect(body.value.is_inclusive_tax).toBe(true);
    expect(body.value.reference_number).toBe(`LAX-SHOP-INV-${ORDER_ID}`);
    expect(body.value.line_items.map((l) => [l.description, l.rate, l.item_id])).toEqual([
      ["Harbour at dusk · Edition 7 of 24", 450, org.lines.goods.itemId],
      ["Framing: Natural oak", 120, org.lines.goods.itemId],
      ["UK insured delivery", 25, org.lines.delivery.itemId],
    ]);
    // London Art Exchange is not VAT registered: no tax id is sent on any line.
    expect(body.value.line_items.every((l) => l.tax_id === undefined)).toBe(true);
  });

  it("refuses a VAT line for London Art Exchange while it is not VAT registered", () => {
    const vat = shopInvoice({
      totalPence: 2_500,
      lines: [
        {
          id: "a",
          kind: "goods",
          label: "Print",
          grossPence: 1_200,
          vatTreatment: "standard",
          vatPence: 200,
        },
      ],
      delivery: { scope: "uk", label: "UK insured delivery", grossPence: 1_300, vatPence: null },
    });
    const body = invoiceBody(vat, "customer-1", org);
    expect(body.ok ? null : body.refusal.code).toBe("vat_on_unregistered_entity");
  });

  it("sends the stored VAT inside the price when the organisation is registered", () => {
    const registered = testOrgConfigs({ shopVatRegistered: true }).london_art_exchange;
    if (!registered) throw new Error("fixture");
    const vat = shopInvoice({
      totalPence: 2_500,
      lines: [
        {
          id: "a",
          kind: "goods",
          label: "Print",
          grossPence: 1_200,
          vatTreatment: "standard",
          vatPence: 200,
        },
      ],
      delivery: { scope: "uk", label: "UK insured delivery", grossPence: 1_300, vatPence: 217 },
    });
    const body = invoiceBody(vat, "customer-1", registered);
    if (!body.ok) throw new Error(body.refusal.code);
    expect(body.value.line_items.map((l) => [l.rate, l.tax_id])).toEqual([
      [12, SHOP_TAX_IDS.standard],
      [13, SHOP_TAX_IDS.standard],
    ]);
  });

  it("leaves a Bid invoice numbered by Books (no LAX number, tax-exclusive)", () => {
    const bidOrg = testOrgConfigs().london_auction_xchange;
    if (!bidOrg) throw new Error("fixture");
    expect(invoiceQuery({ ...shopInvoice(), number: undefined } as Invoice)).toBeUndefined();
  });
});
