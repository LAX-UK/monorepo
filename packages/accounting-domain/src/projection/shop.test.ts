import { describe, expect, it } from "vitest";
import { type Invoice, type Payment, buildInclusiveInvoice, buildInvoice } from "../document.js";
import { cancel, parkedRecord, requeue } from "../lifecycle.js";
import { isParkedReason, parkReasonOf, parkedReasonCode } from "../parking.js";
import { BUILT_FLOWS, PROJECTION_POLICIES } from "./flows.js";
import { parkReasonFor } from "./projection.js";
import {
  type ShopOrderPaidFacts,
  projectShopOrderPaid,
  shopOutsideUkDeliverySourceId,
} from "./shop.js";

const ORDER_ID = "5b6a7c1e-1111-4a5b-8c9d-000000000001";
const PARTY_ID = "5b6a7c1e-2222-4a5b-8c9d-000000000002";
const PRINT_LINE = "5b6a7c1e-3333-4a5b-8c9d-000000000003";
const FRAME_LINE = "5b6a7c1e-4444-4a5b-8c9d-000000000004";

/** A framed print (£450 + £120 frame) delivered in the UK (£25); every VAT figure as stored. */
const facts = (over: Partial<ShopOrderPaidFacts> = {}): ShopOrderPaidFacts => ({
  orderId: ORDER_ID,
  invoiceNumber: "LAX-INV-000124",
  buyer: { partyId: PARTY_ID, name: "Ada Collector", email: "ada@example.com" },
  paidOn: "2026-11-12",
  totalPence: 59_500,
  lines: [
    {
      id: PRINT_LINE,
      kind: "goods",
      label: "Harbour at dusk · Edition 7 of 24",
      grossPence: 45_000,
      vatTreatment: "standard",
      vatPence: 7_500,
    },
    {
      id: FRAME_LINE,
      kind: "framing",
      label: "Framing: Natural oak",
      grossPence: 12_000,
      vatTreatment: "standard",
      vatPence: 2_000,
    },
  ],
  delivery: { scope: "uk", label: "UK insured delivery", grossPence: 2_500, vatPence: 417 },
  ...over,
});

function must<T>(r: { ok: true; value: T } | { ok: false; refusal: { message: string } }): T {
  if (!r.ok) throw new Error(r.refusal.message);
  return r.value;
}

const invoiceOf = (docs: readonly { kind: string }[]) =>
  docs.find((d) => d.kind === "invoice") as Invoice;
const paymentOf = (docs: readonly { kind: string }[]) =>
  docs.find((d) => d.kind === "payment") as Payment;

describe("Shop order paid", () => {
  it("is built and wired as its own flow", () => {
    expect(BUILT_FLOWS).toContain("shop_order_paid");
    expect(PROJECTION_POLICIES.shop_order_paid).toBe(projectShopOrderPaid);
  });

  it("projects the contact, the invoice under the Shop's number, then the payment, in order", () => {
    const { documents, parked } = must(projectShopOrderPaid(facts()));
    expect(documents.map((d) => d.reference)).toEqual([
      `LAX-SHOP-CON-${PARTY_ID}`,
      `LAX-SHOP-INV-${ORDER_ID}`,
      `LAX-SHOP-PAY-${ORDER_ID}`,
    ]);
    expect(parked).toEqual([]);
    const invoice = invoiceOf(documents);
    expect(invoice.number).toBe("LAX-INV-000124");
    expect(invoice.entity).toBe("london_art_exchange");
    expect(invoice.amountsAre).toBe("tax_inclusive");
    expect(invoice.issuedOn).toBe("2026-11-12");
    expect(invoice.dueOn).toBe("2026-11-12");
  });

  it("books every line exactly as stored: gross and VAT, never worked out again", () => {
    const invoice = invoiceOf(must(projectShopOrderPaid(facts())).documents);
    expect(
      invoice.lines.map((l) => [l.description, l.role, l.unitNetPence + l.vatPence, l.vatPence]),
    ).toEqual([
      ["Harbour at dusk · Edition 7 of 24", "goods", 45_000, 7_500],
      ["Framing: Natural oak", "goods", 12_000, 2_000],
      ["UK insured delivery", "delivery", 2_500, 417],
    ]);
    // 417p is the VAT inside £25 (rounded from the inclusive price); 20% of the £20.83 net would
    // be 417p too, but a stored figure that differs from any rule is still booked as stored.
    expect(invoice.totals).toEqual({ netPence: 49_583, vatPence: 9_917, grossPence: 59_500 });
  });

  it("keeps a stored VAT figure that a tax-exclusive rule would not reproduce", () => {
    // 999p at 20% includes 167p (Math.round of 166.5); 20% of the 832p net is 166p.
    const odd = facts({
      totalPence: 999,
      lines: [
        {
          id: PRINT_LINE,
          kind: "goods",
          label: "Postcard",
          grossPence: 999,
          vatTreatment: "standard",
          vatPence: 167,
        },
      ],
      delivery: {
        scope: "uk",
        label: "Collection from our London gallery",
        grossPence: 0,
        vatPence: 0,
      },
    });
    const invoice = invoiceOf(must(projectShopOrderPaid(odd)).documents);
    expect(invoice.totals).toEqual({ netPence: 832, vatPence: 167, grossPence: 999 });
    expect(invoice.lines).toHaveLength(1);
  });

  it("puts framing lines on the same invoice as the print they frame, at the frozen price", () => {
    const invoice = invoiceOf(must(projectShopOrderPaid(facts())).documents);
    expect(invoice.lines.filter((l) => l.description.startsWith("Framing:"))).toHaveLength(1);
    expect(invoice.reference).toBe(`LAX-SHOP-INV-${ORDER_ID}`);
  });

  it("applies the whole payment to the invoice, into clearing", () => {
    const payment = paymentOf(must(projectShopOrderPaid(facts())).documents);
    expect(payment.amountPence).toBe(59_500);
    expect(payment.unallocatedPence).toBe(0);
    expect(payment.allocations).toEqual([
      { invoiceReference: `LAX-SHOP-INV-${ORDER_ID}`, amountPence: 59_500 },
    ]);
  });

  it("is the same documents however often it runs (idempotent by LAX reference)", () => {
    expect(projectShopOrderPaid(facts())).toEqual(projectShopOrderPaid(facts()));
  });

  describe("delivery outside the UK", () => {
    const abroad = () =>
      facts({
        totalPence: 61_000,
        delivery: {
          scope: "outside_uk",
          label: "Delivery outside the UK",
          grossPence: 4_000,
          vatPence: 667,
        },
      });

    it("never puts the quote on the order's invoice", () => {
      const invoice = invoiceOf(must(projectShopOrderPaid(abroad())).documents);
      expect(invoice.lines.map((l) => l.role)).toEqual(["goods", "goods"]);
      expect(invoice.totals.grossPence).toBe(57_000);
    });

    it("invoices the quote on its own and parks it: waiting for the accountant", () => {
      const projection = must(projectShopOrderPaid(abroad()));
      const reference = `LAX-SHOP-INV-${shopOutsideUkDeliverySourceId(ORDER_ID)}`;
      const delivery = projection.documents.find((d) => d.reference === reference) as Invoice;
      expect(delivery.lines.map((l) => [l.role, l.unitNetPence + l.vatPence])).toEqual([
        ["delivery", 4_000],
      ]);
      expect(delivery.number).toBe("LAX-INV-000124-D");
      expect(parkReasonFor(projection, reference)).toBe("vat_on_outside_uk_delivery");
      // Only the delivery is parked: the contact, the order's invoice and the payment are queued.
      expect(projection.parked).toEqual([{ reference, reason: "vat_on_outside_uk_delivery" }]);
      expect(parkReasonFor(projection, `LAX-SHOP-INV-${ORDER_ID}`)).toBeNull();
    });

    it("books the whole payment and leaves the parked delivery's part unapplied", () => {
      const payment = paymentOf(must(projectShopOrderPaid(abroad())).documents);
      expect(payment.amountPence).toBe(61_000);
      expect(payment.allocations).toEqual([
        { invoiceReference: `LAX-SHOP-INV-${ORDER_ID}`, amountPence: 57_000 },
      ]);
      expect(payment.unallocatedPence).toBe(4_000);
    });

    it("parks nothing when the quote is free (nothing to wait for)", () => {
      const free = facts({
        totalPence: 57_000,
        delivery: {
          scope: "outside_uk",
          label: "Delivery outside the UK",
          grossPence: 0,
          vatPence: 0,
        },
      });
      const projection = must(projectShopOrderPaid(free));
      expect(projection.parked).toEqual([]);
      expect(projection.documents).toHaveLength(3);
    });
  });

  describe("refusals (never guessed)", () => {
    it("refuses lines that do not add up to the order's stored total", () => {
      const r = projectShopOrderPaid(facts({ totalPence: 59_501 }));
      expect(r.ok ? null : r.refusal.code).toBe("bad_facts");
    });

    it("refuses a line sold with no VAT recorded", () => {
      const lines = facts().lines.map((l, i) =>
        i === 0 ? { ...l, vatTreatment: null, vatPence: null } : l,
      );
      const r = projectShopOrderPaid(facts({ lines }));
      expect(r.ok ? null : r.refusal.code).toBe("unmapped_line");
    });

    it("refuses a delivery charge with no VAT recorded", () => {
      const r = projectShopOrderPaid(
        facts({
          delivery: {
            scope: "uk",
            label: "UK insured delivery",
            grossPence: 2_500,
            vatPence: null,
          },
        }),
      );
      expect(r.ok ? null : r.refusal.code).toBe("unmapped_line");
    });

    it("refuses an invoice number that is not LAX's", () => {
      const r = projectShopOrderPaid(facts({ invoiceNumber: "inv 1" }));
      expect(r.ok ? null : r.refusal.code).toBe("bad_number");
    });

    it("refuses VAT larger than the price", () => {
      const lines = facts().lines.map((l, i) => (i === 0 ? { ...l, vatPence: 45_001 } : l));
      const r = projectShopOrderPaid(facts({ lines }));
      expect(r.ok ? null : r.refusal.code).toBe("bad_line");
    });
  });
});

describe("VAT-inclusive invoices", () => {
  const contactReference = `LAX-SHOP-CON-${PARTY_ID}`;
  it("refuses a number on a tax-exclusive rebuild (a numbered invoice is inclusive)", () => {
    const inclusive = must(
      buildInclusiveInvoice({
        product: "shop",
        sourceId: "order-1",
        contactReference,
        issuedOn: "2026-11-12",
        dueOn: "2026-11-12",
        number: "LAX-INV-000001",
        lines: [
          {
            description: "Print",
            grossPence: 1_200,
            vatPence: 200,
            treatment: "standard",
            role: "goods",
          },
        ],
      }),
    );
    expect(inclusive.totals).toEqual({ netPence: 1_000, vatPence: 200, grossPence: 1_200 });
    const exclusive = must(
      buildInvoice({
        product: "shop",
        sourceId: "order-1",
        contactReference,
        issuedOn: "2026-11-12",
        dueOn: "2026-11-12",
        lines: [
          {
            description: "Print",
            quantity: 1,
            unitNetPence: 1_000,
            treatment: "standard",
            role: "goods",
          },
        ],
      }),
    );
    expect(exclusive.number).toBeUndefined();
    expect(exclusive.amountsAre).toBeUndefined();
  });
});

describe("Parking", () => {
  it("names the outside-UK delivery reason and reads it back", () => {
    const code = parkedReasonCode("vat_on_outside_uk_delivery");
    expect(code).toBe("accounting_parked_vat_on_outside_uk_delivery");
    expect(parkReasonOf(code)).toBe("vat_on_outside_uk_delivery");
    expect(isParkedReason("zoho_books_validation_invalid_request")).toBe(false);
  });

  it("a parked record is never requeued, only cancelled", () => {
    const record = parkedRecord(
      "invoice",
      `LAX-SHOP-INV-${ORDER_ID}-delivery`,
      "vat_on_outside_uk_delivery",
    );
    expect(record.status).toBe("needs_review");
    const again = requeue(record);
    expect(again.ok ? null : again.refusal.code).toBe("parked");
    const stopped = cancel(record);
    expect(stopped.ok && stopped.value.status).toBe("cancelled");
  });
});
