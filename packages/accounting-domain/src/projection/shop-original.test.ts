import { describe, expect, it } from "vitest";
import type { Contact, Invoice, Payment } from "../document.js";
import { BUILT_FLOWS, PROJECTION_POLICIES } from "./flows.js";
import {
  type ShopOriginalSalePaidFacts,
  projectShopOriginalSalePaid,
  shopOriginalSaleIdOf,
  shopOriginalSaleSourceId,
} from "./shop-original.js";
import { projectShopOrderPaid } from "./shop.js";

const SALE_ID = "7c1e5b6a-1111-4a5b-8c9d-000000000001";
const PARTY_ID = "7c1e5b6a-2222-4a5b-8c9d-000000000002";

/** An original sold for £12,500 with no VAT recorded on the sale (fixture data only). */
const facts = (over: Partial<ShopOriginalSalePaidFacts> = {}): ShopOriginalSalePaidFacts => ({
  originalSaleId: SALE_ID,
  invoiceNumber: "LAX-INV-000125",
  buyer: { partyId: PARTY_ID, name: "Ada Collector", email: "ada@example.com" },
  paidOn: "2026-11-14",
  label: "Original artwork: Harbour at dusk",
  salePricePence: 1_250_000,
  vatTreatment: null,
  vatPence: null,
  ...over,
});

function documents(f: ShopOriginalSalePaidFacts) {
  const result = projectShopOriginalSalePaid(f);
  if (!result.ok) throw new Error(result.refusal.message);
  const [contact, invoice, payment] = result.value.documents as [Contact, Invoice, Payment];
  return { contact, invoice, payment, parked: result.value.parked };
}

describe("Shop original sold (flow 22)", () => {
  it("is a built flow, wired to its policy", () => {
    expect(BUILT_FLOWS).toContain("shop_original_sale_paid");
    expect(PROJECTION_POLICIES.shop_original_sale_paid).toBe(projectShopOriginalSalePaid);
  });

  it("invoices the original under the Shop's LAX-INV- number from London Art Exchange, paid in full", () => {
    const { contact, invoice, payment, parked } = documents(facts());
    expect(parked).toEqual([]);
    expect(contact.reference).toBe(`LAX-SHOP-CON-${PARTY_ID}`);
    expect(invoice).toMatchObject({
      reference: `LAX-SHOP-INV-original-${SALE_ID}`,
      entity: "london_art_exchange",
      number: "LAX-INV-000125",
      contactReference: contact.reference,
      issuedOn: "2026-11-14",
      dueOn: "2026-11-14",
      amountsAre: "tax_inclusive",
    });
    expect(invoice.lines).toHaveLength(1);
    expect(invoice.lines[0]).toMatchObject({
      description: "Original artwork: Harbour at dusk",
      treatment: "outside_scope",
      role: "goods",
    });
    expect(invoice.totals).toMatchObject({ grossPence: 1_250_000, vatPence: 0 });
    expect(payment).toMatchObject({
      reference: `LAX-SHOP-PAY-original-${SALE_ID}`,
      receivedOn: "2026-11-14",
      amountPence: 1_250_000,
      unallocatedPence: 0,
      allocations: [{ invoiceReference: invoice.reference, amountPence: 1_250_000 }],
    });
  });

  it("names the same contact as the buyer's Shop orders", () => {
    const order = projectShopOrderPaid({
      orderId: "7c1e5b6a-3333-4a5b-8c9d-000000000003",
      invoiceNumber: "LAX-INV-000124",
      buyer: { partyId: PARTY_ID, name: "Ada Collector", email: "ada@example.com" },
      paidOn: "2026-11-12",
      totalPence: 100,
      lines: [
        {
          id: "7c1e5b6a-4444-4a5b-8c9d-000000000004",
          kind: "goods",
          label: "Print",
          grossPence: 100,
          vatTreatment: null,
          vatPence: null,
        },
      ],
      delivery: { scope: "uk", label: "Collection", grossPence: 0, vatPence: null },
    });
    if (!order.ok) throw new Error(order.refusal.message);
    expect(order.value.documents[0]).toEqual(documents(facts()).contact);
  });

  it("books standard VAT as stored on the sale, never worked out again", () => {
    const { invoice } = documents(facts({ vatTreatment: "standard", vatPence: 208_333 }));
    expect(invoice.lines[0]).toMatchObject({ treatment: "standard" });
    expect(invoice.totals).toMatchObject({ grossPence: 1_250_000, vatPence: 208_333 });
  });

  it("refuses a VAT treatment it has no booking for, and standard with no stored VAT", () => {
    expect(
      projectShopOriginalSalePaid(facts({ vatTreatment: "margin", vatPence: 0 })),
    ).toMatchObject({ ok: false, refusal: { code: "unmapped_line" } });
    expect(
      projectShopOriginalSalePaid(facts({ vatTreatment: "standard", vatPence: null })),
    ).toMatchObject({ ok: false, refusal: { code: "unmapped_line" } });
  });

  it("refuses a sale for nothing, or for part pence", () => {
    expect(projectShopOriginalSalePaid(facts({ salePricePence: 0 }))).toMatchObject({
      ok: false,
      refusal: { code: "bad_amount" },
    });
    expect(projectShopOriginalSalePaid(facts({ salePricePence: 10.5 }))).toMatchObject({
      ok: false,
    });
  });

  it("refuses an invoice without the Shop's number", () => {
    expect(projectShopOriginalSalePaid(facts({ invoiceNumber: "" })).ok).toBe(false);
  });

  it("gives its documents references no Shop order can have", () => {
    expect(shopOriginalSaleSourceId(SALE_ID.toUpperCase())).toBe(`original-${SALE_ID}`);
    expect(shopOriginalSaleIdOf(`original-${SALE_ID}`)).toBe(SALE_ID);
    expect(shopOriginalSaleIdOf(SALE_ID)).toBeNull();
    expect(shopOriginalSaleIdOf(`original-${SALE_ID}-delivery`)).toBeNull();
  });
});
