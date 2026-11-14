import { describe, expect, it } from "vitest";
import { type Invoice, type Payment, buildInclusiveInvoice, buildInvoice } from "../document.js";
import { cancel, parkedRecord, release, requeue } from "../lifecycle.js";
import { isParkedReason, parkReasonOf, parkedReasonCode } from "../parking.js";
import { resolveParked } from "../release.js";
import { planRemainder } from "../remainder.js";
import type { LineBooking } from "./bid.js";
import { BUILT_FLOWS, PROJECTION_POLICIES } from "./flows.js";
import { parkReasonFor } from "./projection.js";
import {
  SHOP_OUTSIDE_UK_DELIVERY_BOOKING,
  type ShopOrderPaidFacts,
  projectShopOrderPaid,
  rebuildShopOutsideUkDelivery,
  shopDeliveryPaymentReference,
  shopOrderPaidPolicy,
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
      // No VAT on delivery outside the UK: LAX never states any, whatever was stored.
      expect(delivery.totals.vatPence).toBe(0);
      expect(delivery.lines[0]?.treatment).toBe("outside_scope");
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

    it("books a line sold with no VAT recorded as charged: no VAT, never added", () => {
      const none = facts({
        lines: facts().lines.map((l) => ({ ...l, vatTreatment: null, vatPence: null })),
        delivery: { scope: "uk", label: "UK insured delivery", grossPence: 2_500, vatPence: null },
      });
      const invoice = invoiceOf(must(projectShopOrderPaid(none)).documents);
      expect(invoice.lines.map((l) => [l.treatment, l.vatPence])).toEqual([
        ["outside_scope", 0],
        ["outside_scope", 0],
        ["outside_scope", 0],
      ]);
      expect(invoice.totals).toEqual({ netPence: 59_500, vatPence: 0, grossPence: 59_500 });
    });

    it("refuses a VAT treatment it has no booking for", () => {
      const lines = facts().lines.map((l, i) => (i === 0 ? { ...l, vatTreatment: "reduced" } : l));
      const r = projectShopOrderPaid(facts({ lines }));
      expect(r.ok ? null : r.refusal.code).toBe("unmapped_line");
    });

    it("refuses a line that names a treatment but no VAT figure", () => {
      const lines = facts().lines.map((l, i) => (i === 0 ? { ...l, vatPence: null } : l));
      const r = projectShopOrderPaid(facts({ lines }));
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

  it("a parked record is never requeued; it is released once settled, or cancelled", () => {
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
    const released = release(record);
    expect(released.ok && released.value.status).toBe("pending");
  });
});

describe("Release of a parked outside-UK delivery", () => {
  const abroad = facts({
    totalPence: 61_000,
    delivery: {
      scope: "outside_uk",
      label: "Delivery outside the UK",
      grossPence: 4_000,
      vatPence: null,
    },
  });
  const reference = `LAX-SHOP-INV-${shopOutsideUkDeliverySourceId(ORDER_ID)}`;
  const parkedNow = must(projectShopOrderPaid(abroad));
  const draft = parkedNow.documents.find((d) => d.reference === reference) as Invoice;
  /** A booking the accountant might give that keeps what was charged (no VAT added on top). */
  const ZERO: LineBooking = { role: "delivery", treatment: "zero" };
  const STANDARD: LineBooking = { role: "delivery", treatment: "standard" };

  it("no booking is set: LAX states no VAT treatment of its own", () => {
    expect(SHOP_OUTSIDE_UK_DELIVERY_BOOKING).toBeNull();
  });

  it("is refused while the accountant has not answered: the stored rows still park it", () => {
    const resolved = resolveParked(
      { document: draft, reason: "vat_on_outside_uk_delivery" },
      parkedNow,
    );
    expect(resolved.ok ? null : resolved.refusal.code).toBe("unresolved");
  });

  it("with the booking, is the invoice rebuilt from the stored order, same reference and gross", () => {
    const rebuilt = must(shopOrderPaidPolicy(ZERO)(abroad));
    expect(parkReasonFor(rebuilt, reference)).toBeNull();
    const released = must(
      resolveParked({ document: draft, reason: "vat_on_outside_uk_delivery" }, rebuilt),
    );
    expect(released.rebuilt).toBe(true);
    const invoice = released.document as Invoice;
    expect(invoice.reference).toBe(reference);
    expect(invoice.totals.grossPence).toBe(4_000);
    expect(invoice.lines[0]?.treatment).toBe("zero");
    // The payment is the one already booked: applied to the goods only, the rest unapplied.
    expect(paymentOf(rebuilt.documents)).toEqual(paymentOf(parkedNow.documents));
  });

  it("Release rebuilds it from the order's stored delivery alone, as the projection would", () => {
    const stored = abroad.delivery;
    const now = must(rebuildShopOutsideUkDelivery(draft, stored, null));
    const still = resolveParked({ document: draft, reason: "vat_on_outside_uk_delivery" }, now);
    expect(still.ok ? null : still.refusal.code).toBe("unresolved");
    const booked = must(rebuildShopOutsideUkDelivery(draft, stored, ZERO));
    const fromOrder = must(shopOrderPaidPolicy(ZERO)(abroad)).documents.find(
      (d) => d.reference === reference,
    );
    expect(booked.documents).toEqual([fromOrder]);
    const released = must(
      resolveParked({ document: draft, reason: "vat_on_outside_uk_delivery" }, booked),
    );
    expect(released).toEqual({ document: fromOrder, rebuilt: true });
  });

  it("Release refuses when the order no longer charges that delivery outside the UK", () => {
    const moved = rebuildShopOutsideUkDelivery(
      draft,
      { ...abroad.delivery, grossPence: 4_100 },
      ZERO,
    );
    expect(moved.ok ? null : moved.refusal.code).toBe("bad_facts");
    const uk = rebuildShopOutsideUkDelivery(draft, { ...abroad.delivery, scope: "uk" }, ZERO);
    expect(uk.ok ? null : uk.refusal.code).toBe("bad_facts");
    const goods = rebuildShopOutsideUkDelivery(
      invoiceOf(parkedNow.documents),
      abroad.delivery,
      ZERO,
    );
    expect(goods.ok ? null : goods.refusal.code).toBe("bad_facts");
  });

  it("a VAT-bearing booking with no VAT stored on the order is refused, never worked out", () => {
    const r = shopOrderPaidPolicy(STANDARD)(abroad);
    expect(r.ok ? null : r.refusal.code).toBe("line_awaiting_accountant");
  });

  it("the payment's unapplied rest is applied to the released invoice, exactly its gross", () => {
    const rebuilt = must(shopOrderPaidPolicy(ZERO)(abroad));
    const invoice = rebuilt.documents.find((d) => d.reference === reference) as Invoice;
    const plan = must(planRemainder(paymentOf(rebuilt.documents), invoice));
    expect(plan).toEqual({
      product: "shop",
      entity: "london_art_exchange",
      paymentReference: `LAX-SHOP-PAY-${ORDER_ID}`,
      invoiceReference: reference,
      contactReference: `LAX-SHOP-CON-${PARTY_ID}`,
      amountPence: 4_000,
    });
  });

  it("names the order payment that pays the delivery invoice, and nothing for any other", () => {
    expect(shopDeliveryPaymentReference(reference)).toBe(`LAX-SHOP-PAY-${ORDER_ID}`);
    expect(shopDeliveryPaymentReference(`LAX-SHOP-INV-${ORDER_ID}`)).toBeNull();
    expect(shopDeliveryPaymentReference(`LAX-BID-INV-${ORDER_ID}-delivery`)).toBeNull();
    expect(shopDeliveryPaymentReference(`LAX-SHOP-PAY-${ORDER_ID}-delivery`)).toBeNull();
  });

  it("refuses to apply a remainder to the goods invoice, another buyer's, or more than is left", () => {
    const payment = paymentOf(parkedNow.documents);
    const goods = invoiceOf(parkedNow.documents);
    const already = planRemainder(payment, goods);
    expect(already.ok ? null : already.refusal.code).toBe("already_allocated");
    const other = { ...draft, contactReference: "LAX-SHOP-CON-someone-else" };
    const notPaired = planRemainder(payment, other);
    expect(notPaired.ok ? null : notPaired.refusal.code).toBe("not_paired");
    const bigger = { ...draft, totals: { ...draft.totals, grossPence: 4_001 } };
    const exceeds = planRemainder(payment, bigger);
    expect(exceeds.ok ? null : exceeds.refusal.code).toBe("exceeds_remainder");
    const reversed = planRemainder(draft, payment);
    expect(reversed.ok ? null : reversed.refusal.code).toBe("not_paired");
  });
});
