import { describe, expect, it } from "vitest";
import { type CreditNote, buildCreditNoteFor, creditedOnInvoiceLines } from "../document.js";
import { lineGrossPence } from "../money.js";
import { BUILT_FLOWS, PROJECTION_POLICIES } from "./flows.js";
import {
  type ShopRefundFacts,
  type ShopRefundsFacts,
  projectShopRefundReversed,
  projectShopRefundSettled,
  shopCreditBuiltAfter,
} from "./shop-refunds.js";
import { type ShopOrderPaidFacts, shopOrderInvoice } from "./shop.js";

const ORDER_ID = "5b6a7c1e-1111-4a5b-8c9d-000000000001";
const PARTY_ID = "5b6a7c1e-2222-4a5b-8c9d-000000000002";
const PRINT_LINE = "5b6a7c1e-3333-4a5b-8c9d-000000000003";
const FRAME_LINE = "5b6a7c1e-4444-4a5b-8c9d-000000000004";
const R1 = "5b6a7c1e-5555-4a5b-8c9d-000000000001";
const R2 = "5b6a7c1e-5555-4a5b-8c9d-000000000002";
const R3 = "5b6a7c1e-5555-4a5b-8c9d-000000000003";
const SECOND_FRAME_LINE = "5b6a7c1e-4444-4a5b-8c9d-000000000005";

/** The same order delivered outside the UK (£60, invoiced on its own and parked). */
const outsideUk = (over: Partial<ShopOrderPaidFacts> = {}) =>
  order({
    totalPence: 63_000,
    delivery: {
      scope: "outside_uk",
      label: "Delivery outside the UK",
      grossPence: 6_000,
      vatPence: null,
    },
    ...over,
  });

/** A framed print (£450 + £120 frame) delivered in the UK (£25), as the paid flow reads it. */
const order = (over: Partial<ShopOrderPaidFacts> = {}): ShopOrderPaidFacts => ({
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

const refund = (refundId: string, over: Partial<ShopRefundFacts> = {}): ShopRefundFacts => ({
  refundId,
  amountPence: 45_000,
  refundedOn: "2026-11-13",
  orderLineId: PRINT_LINE,
  settledOutside: false,
  ...over,
});

const facts = (over: Partial<ShopRefundsFacts> = {}): ShopRefundsFacts => ({
  order: order(),
  refunds: [refund(R1)],
  refundId: R1,
  registered: [],
  ...over,
});

function must<T>(r: { ok: true; value: T } | { ok: false; refusal: { message: string } }): T {
  if (!r.ok) throw new Error(r.refusal.message);
  return r.value;
}

const notesOf = (docs: readonly { kind: string }[]) =>
  docs.filter((d) => d.kind === "credit_note") as CreditNote[];

describe("Shop refund settled (flow 21)", () => {
  it("is built and wired as its own flow", () => {
    expect(BUILT_FLOWS).toContain("shop_refund_settled");
    expect(PROJECTION_POLICIES.shop_refund_settled).toBe(projectShopRefundSettled);
  });

  it("credits a line's refund on that line, after the contact and invoice, refunded from clearing", () => {
    const { documents, parked } = must(projectShopRefundSettled(facts()));
    expect(documents.map((d) => d.reference)).toEqual([
      `LAX-SHOP-CON-${PARTY_ID}`,
      `LAX-SHOP-INV-${ORDER_ID}`,
      `LAX-SHOP-CN-${R1}`,
    ]);
    expect(parked).toBeUndefined();
    const [note] = notesOf(documents);
    expect(note?.entity).toBe("london_art_exchange");
    expect(note?.invoiceReference).toBe(`LAX-SHOP-INV-${ORDER_ID}`);
    expect(note?.lines.map((l) => [l.description, lineGrossPence(l), l.vatPence])).toEqual([
      ["Credit: Harbour at dusk · Edition 7 of 24", 45_000, 7_500],
    ]);
    expect(note?.refund).toEqual({ account: "stripe_clearing", refundedOn: "2026-11-13" });
  });

  it("credits a whole-order cancellation line by line, delivery included, never above the charge", () => {
    const { documents } = must(
      projectShopRefundSettled(
        facts({ refunds: [refund(R1, { amountPence: 59_500, orderLineId: null })] }),
      ),
    );
    const [note] = notesOf(documents);
    expect(note?.totals.grossPence).toBe(59_500);
    expect(note?.lines.map((l) => lineGrossPence(l))).toEqual([45_000, 12_000, 2_500]);
    expect(note?.lines.map((l) => l.vatPence)).toEqual([7_500, 2_000, 417]);
  });

  it("refuses for staff a part refund naming no line on an order of several lines", () => {
    const result = projectShopRefundSettled(
      facts({ refunds: [refund(R1, { amountPence: 10_000, orderLineId: null })] }),
    );
    expect(result.ok ? null : result.refusal.code).toBe("refund_unattributed");
  });

  it("credits a frame's refund on the frame while the print is kept (review RVa)", () => {
    const { documents } = must(
      projectShopRefundSettled(
        facts({ refunds: [refund(R1, { amountPence: 12_000, orderLineId: FRAME_LINE })] }),
      ),
    );
    const notes = notesOf(documents);
    expect(notes.map((n) => n.reference)).toEqual([`LAX-SHOP-CN-${R1}`]);
    expect(notes[0]?.lines.map((l) => [l.description, lineGrossPence(l), l.vatPence])).toEqual([
      ["Credit: Framing: Natural oak", 12_000, 2_000],
    ]);
    // The print's refund later is credited on the print, after the frame's note as stored.
    const later = must(
      projectShopRefundSettled(
        facts({
          refunds: [refund(R1, { amountPence: 12_000, orderLineId: FRAME_LINE }), refund(R2)],
          refundId: R2,
          registered: notes,
        }),
      ),
    );
    expect(notesOf(later.documents).map((n) => n.lines.map((l) => l.description))).toEqual([
      ["Credit: Harbour at dusk · Edition 7 of 24"],
    ]);
  });

  it("credits a line's refund after a part refund of an earlier line (review RVc)", () => {
    const part = notesOf(
      must(projectShopRefundSettled(facts({ refunds: [refund(R1, { amountPence: 10_000 })] })))
        .documents,
    );
    const { documents } = must(
      projectShopRefundSettled(
        facts({
          refunds: [
            refund(R1, { amountPence: 10_000 }),
            refund(R2, { amountPence: 12_000, orderLineId: FRAME_LINE }),
          ],
          refundId: R2,
          registered: part,
        }),
      ),
    );
    expect(
      notesOf(documents).map((n) => n.lines.map((l) => [l.description, lineGrossPence(l)])),
    ).toEqual([[["Credit: Framing: Natural oak", 12_000]]]);
  });

  it("holds every later refund behind one that waits for staff, and never credits it later (review RVb)", () => {
    // R1 names no line on an order of several lines: not certain. R2 and R3 come after it.
    const refunds = [
      refund(R1, { amountPence: 2_000, orderLineId: null }),
      refund(R2),
      refund(R3, { amountPence: 12_000, orderLineId: FRAME_LINE }),
    ];
    for (const refundId of [R1, R2, R3]) {
      const result = projectShopRefundSettled(facts({ refunds, refundId }));
      expect(result.ok ? null : result.refusal.code).toBe("refund_unattributed");
    }
    const behind = projectShopRefundSettled(facts({ refunds, refundId: R3 }));
    expect(behind.ok ? "" : behind.refusal.message).toContain(`waits behind refund ${R1}`);
    // Nothing is made for any of them, on any event: R1 is booked by hand, and so are R2 and R3.
    expect(behind.ok).toBe(false);
  });

  it("credits a refund naming no line that went through after the others, once it is certain", () => {
    const print = notesOf(must(projectShopRefundSettled(facts())).documents);
    const frame = notesOf(
      must(
        projectShopRefundSettled(
          facts({
            refunds: [refund(R1), refund(R2, { amountPence: 12_000, orderLineId: FRAME_LINE })],
            refundId: R2,
            registered: print,
          }),
        ),
      ).documents,
    );
    const { documents } = must(
      projectShopRefundSettled(
        facts({
          refunds: [
            refund(R1),
            refund(R2, { amountPence: 12_000, orderLineId: FRAME_LINE }),
            refund(R3, { amountPence: 2_000, orderLineId: null }),
          ],
          refundId: R3,
          registered: [...print, ...frame],
        }),
      ),
    );
    expect(notesOf(documents).map((n) => n.reference)).toEqual([`LAX-SHOP-CN-${R3}`]);
  });

  it("credits each line's refund on its own line, whichever comes first", () => {
    const { documents } = must(
      projectShopRefundSettled(
        facts({
          refunds: [refund(R1, { amountPence: 12_000, orderLineId: FRAME_LINE }), refund(R2)],
          refundId: R1,
        }),
      ),
    );
    expect(notesOf(documents).map((n) => [n.reference, n.lines[0]?.description])).toEqual([
      [`LAX-SHOP-CN-${R1}`, "Credit: Framing: Natural oak"],
      [`LAX-SHOP-CN-${R2}`, "Credit: Harbour at dusk · Edition 7 of 24"],
    ]);
  });

  it("places a refund naming no line on the one line with credit left", () => {
    // 57,000 is not everything (59,500): refused on its own event.
    const part = projectShopRefundSettled(
      facts({ refunds: [refund(R1, { amountPence: 57_000, orderLineId: null })] }),
    );
    expect(part.ok ? null : part.refusal.code).toBe("refund_unattributed");
    const print = notesOf(must(projectShopRefundSettled(facts())).documents);
    const frame = notesOf(
      must(
        projectShopRefundSettled(
          facts({
            refunds: [refund(R1), refund(R2, { amountPence: 12_000, orderLineId: FRAME_LINE })],
            refundId: R2,
            registered: print,
          }),
        ),
      ).documents,
    );
    const { documents } = must(
      projectShopRefundSettled(
        facts({
          refunds: [
            refund(R1),
            refund(R2, { amountPence: 12_000, orderLineId: FRAME_LINE }),
            refund(R3, { amountPence: 2_000, orderLineId: null }),
          ],
          refundId: R3,
          registered: [...print, ...frame],
        }),
      ),
    );
    const [note] = notesOf(documents);
    expect(note?.lines.map((l) => [l.role, lineGrossPence(l)])).toEqual([["delivery", 2_000]]);
  });

  it("never credits a line more than it charged, however the refunds are recorded", () => {
    const first = notesOf(must(projectShopRefundSettled(facts())).documents);
    const result = projectShopRefundSettled(
      facts({
        refunds: [refund(R1), refund(R2, { amountPence: 100 })],
        refundId: R2,
        registered: first,
      }),
    );
    expect(result.ok ? null : result.refusal.code).toBe("refund_unattributed");
  });

  it("never spills a line's refund larger than the line onto the next line", () => {
    const result = projectShopRefundSettled(
      facts({ refunds: [refund(R1, { amountPence: 50_000 })] }),
    );
    expect(result.ok ? null : result.refusal.code).toBe("refund_unattributed");
  });

  it("parks a refund settled outside Stripe, with no money back from clearing", () => {
    const { documents, parked } = must(
      projectShopRefundSettled(facts({ refunds: [refund(R1, { settledOutside: true })] })),
    );
    const [note] = notesOf(documents);
    expect(note?.refund).toBeUndefined();
    expect(parked).toEqual([{ reference: `LAX-SHOP-CN-${R1}`, reason: "refund_outside_stripe" }]);
  });

  it("does not place a refund naming no line when delivery outside the UK has its own invoice", () => {
    const outside = order({
      totalPence: 63_000,
      delivery: {
        scope: "outside_uk",
        label: "Delivery outside the UK",
        grossPence: 6_000,
        vatPence: null,
      },
    });
    const result = projectShopRefundSettled(
      facts({ order: outside, refunds: [refund(R1, { amountPence: 57_000, orderLineId: null })] }),
    );
    expect(result.ok ? null : result.refusal.code).toBe("refund_unattributed");
    const line = must(projectShopRefundSettled(facts({ order: outside })));
    expect(notesOf(line.documents)).toHaveLength(1);
  });

  it("dates a refund recorded before the invoice day on the invoice's day", () => {
    const { documents } = must(
      projectShopRefundSettled(facts({ refunds: [refund(R1, { refundedOn: "2026-11-01" })] })),
    );
    expect(notesOf(documents)[0]?.issuedOn).toBe("2026-11-12");
  });

  it("refuses a registered credit note of another invoice", () => {
    const first = notesOf(must(projectShopRefundSettled(facts())).documents);
    const other = { ...(first[0] as CreditNote), invoiceReference: "LAX-SHOP-INV-other" };
    const result = projectShopRefundSettled(facts({ registered: [other] }));
    expect(result.ok ? null : result.refusal.code).toBe("bad_facts");
  });

  it("states the credit each new note was built after, for the registry to check", () => {
    const first = notesOf(must(projectShopRefundSettled(facts())).documents);
    const { documents } = must(
      projectShopRefundSettled(
        facts({
          refunds: [refund(R1), refund(R2, { amountPence: 12_000, orderLineId: FRAME_LINE })],
          refundId: R2,
          registered: first,
        }),
      ),
    );
    expect(shopCreditBuiltAfter(documents, first)).toEqual([
      { reference: `LAX-SHOP-CN-${R2}`, priorCreditPence: 45_000 },
    ]);
  });

  describe("two frames sold under the same name", () => {
    const frame = (id: string, grossPence: number, vatPence: number) => ({
      id,
      kind: "framing" as const,
      label: "Framing: Natural oak",
      grossPence,
      vatTreatment: "standard" as const,
      vatPence,
    });
    const twoFrames = (second: number, secondVat: number) =>
      order({
        totalPence: 45_000 + 12_000 + second + 2_500,
        lines: [...order().lines, frame(SECOND_FRAME_LINE, second, secondVat)],
      });

    it("credits each of two identical frames once, and never more than both charged", () => {
      const o = twoFrames(12_000, 2_000);
      const first = notesOf(
        must(
          projectShopRefundSettled(
            facts({
              order: o,
              refunds: [refund(R1, { amountPence: 12_000, orderLineId: SECOND_FRAME_LINE })],
            }),
          ),
        ).documents,
      );
      const second = must(
        projectShopRefundSettled(
          facts({
            order: o,
            refunds: [
              refund(R1, { amountPence: 12_000, orderLineId: SECOND_FRAME_LINE }),
              refund(R2, { amountPence: 12_000, orderLineId: FRAME_LINE }),
            ],
            refundId: R2,
            registered: first,
          }),
        ),
      );
      expect(notesOf(second.documents).map((n) => n.totals.grossPence)).toEqual([12_000]);
      const third = projectShopRefundSettled(
        facts({
          order: o,
          refunds: [
            refund(R1, { amountPence: 12_000, orderLineId: SECOND_FRAME_LINE }),
            refund(R2, { amountPence: 12_000, orderLineId: FRAME_LINE }),
            refund(R3, { amountPence: 1, orderLineId: FRAME_LINE }),
          ],
          refundId: R3,
          registered: [...first, ...notesOf(second.documents)],
        }),
      );
      expect(third.ok ? null : third.refusal.code).toBe("refund_unattributed");
    });

    it("credits a cheaper frame of the same name, then the dearer one in full, never more than both", () => {
      const o = twoFrames(6_000, 1_000);
      const cheap = notesOf(
        must(
          projectShopRefundSettled(
            facts({
              order: o,
              refunds: [refund(R1, { amountPence: 6_000, orderLineId: SECOND_FRAME_LINE })],
            }),
          ),
        ).documents,
      );
      expect(cheap[0]?.lines.map((l) => [lineGrossPence(l), l.vatPence])).toEqual([[6_000, 1_000]]);
      const dear = must(
        projectShopRefundSettled(
          facts({
            order: o,
            refunds: [
              refund(R1, { amountPence: 6_000, orderLineId: SECOND_FRAME_LINE }),
              refund(R2, { amountPence: 12_000, orderLineId: FRAME_LINE }),
            ],
            refundId: R2,
            registered: cheap,
          }),
        ),
      );
      const [note] = notesOf(dear.documents);
      // The books cannot tell the two frames apart: the dearer one's refund is what is left on both.
      expect([note?.totals.grossPence, note?.totals.vatPence]).toEqual([12_000, 2_000]);
      expect(new Set(note?.lines.map((l) => l.description))).toEqual(
        new Set(["Credit: Framing: Natural oak"]),
      );
      const more = projectShopRefundSettled(
        facts({
          order: o,
          refunds: [
            refund(R1, { amountPence: 6_000, orderLineId: SECOND_FRAME_LINE }),
            refund(R2, { amountPence: 12_000, orderLineId: FRAME_LINE }),
            refund(R3, { amountPence: 1, orderLineId: SECOND_FRAME_LINE }),
          ],
          refundId: R3,
          registered: [...cheap, ...notesOf(dear.documents)],
        }),
      );
      expect(more.ok ? null : more.refusal.code).toBe("refund_unattributed");
    });
  });

  describe("delivery outside the UK (review F4)", () => {
    it("credits a whole-order refund on both invoices, the delivery's part parked with its invoice", () => {
      const { documents, parked } = must(
        projectShopRefundSettled(
          facts({
            order: outsideUk(),
            refunds: [refund(R1, { amountPence: 63_000, orderLineId: null })],
          }),
        ),
      );
      expect(documents.map((d) => d.reference)).toEqual([
        `LAX-SHOP-CON-${PARTY_ID}`,
        `LAX-SHOP-INV-${ORDER_ID}`,
        `LAX-SHOP-INV-${ORDER_ID}-delivery`,
        `LAX-SHOP-CN-${R1}`,
        `LAX-SHOP-CN-${R1}-delivery`,
      ]);
      const notes = notesOf(documents);
      expect(notes.map((n) => [n.invoiceReference, n.totals.grossPence])).toEqual([
        [`LAX-SHOP-INV-${ORDER_ID}`, 57_000],
        [`LAX-SHOP-INV-${ORDER_ID}-delivery`, 6_000],
      ]);
      expect(notes.every((n) => n.refund?.account === "stripe_clearing")).toBe(true);
      expect(parked).toEqual([
        { reference: `LAX-SHOP-INV-${ORDER_ID}-delivery`, reason: "vat_on_outside_uk_delivery" },
        { reference: `LAX-SHOP-CN-${R1}-delivery`, reason: "vat_on_outside_uk_delivery" },
      ]);
      expect(shopCreditBuiltAfter(documents, [])).toEqual([
        { reference: `LAX-SHOP-CN-${R1}`, priorCreditPence: 0 },
        { reference: `LAX-SHOP-CN-${R1}-delivery`, priorCreditPence: 0 },
      ]);
    });

    it("credits the rest of the order and the delivery after a line's refund", () => {
      const print = notesOf(
        must(projectShopRefundSettled(facts({ order: outsideUk() }))).documents,
      );
      const { documents } = must(
        projectShopRefundSettled(
          facts({
            order: outsideUk(),
            refunds: [refund(R1), refund(R2, { amountPence: 18_000, orderLineId: null })],
            refundId: R2,
            registered: print,
          }),
        ),
      );
      expect(notesOf(documents).map((n) => [n.reference, n.totals.grossPence])).toEqual([
        [`LAX-SHOP-CN-${R2}`, 12_000],
        [`LAX-SHOP-CN-${R2}-delivery`, 6_000],
      ]);
      expect(shopCreditBuiltAfter(documents, print)).toEqual([
        { reference: `LAX-SHOP-CN-${R2}`, priorCreditPence: 45_000 },
        { reference: `LAX-SHOP-CN-${R2}-delivery`, priorCreditPence: 0 },
      ]);
    });

    it("keeps refusing a part refund naming no line, even one the size of the delivery", () => {
      for (const amountPence of [6_000, 57_000, 62_999]) {
        const result = projectShopRefundSettled(
          facts({ order: outsideUk(), refunds: [refund(R1, { amountPence, orderLineId: null })] }),
        );
        expect(result.ok ? null : result.refusal.code).toBe("refund_unattributed");
      }
    });

    it("parks both credit notes of a whole-order refund settled outside Stripe, with no money back", () => {
      const { documents, parked } = must(
        projectShopRefundSettled(
          facts({
            order: outsideUk(),
            refunds: [refund(R1, { amountPence: 63_000, orderLineId: null, settledOutside: true })],
          }),
        ),
      );
      expect(notesOf(documents).map((n) => n.refund)).toEqual([undefined, undefined]);
      expect(parked).toEqual([
        { reference: `LAX-SHOP-INV-${ORDER_ID}-delivery`, reason: "vat_on_outside_uk_delivery" },
        { reference: `LAX-SHOP-CN-${R1}`, reason: "refund_outside_stripe" },
        { reference: `LAX-SHOP-CN-${R1}-delivery`, reason: "refund_outside_stripe" },
      ]);
    });

    it("keeps a registered delivery credit note and makes nothing more for its refund", () => {
      const first = notesOf(
        must(
          projectShopRefundSettled(
            facts({
              order: outsideUk(),
              refunds: [refund(R1, { amountPence: 63_000, orderLineId: null })],
            }),
          ),
        ).documents,
      );
      const again = must(
        projectShopRefundSettled(
          facts({
            order: outsideUk(),
            refunds: [refund(R1, { amountPence: 63_000, orderLineId: null })],
            registered: first.filter((n) => !n.reference.endsWith("-delivery")),
            registeredDelivery: first.filter((n) => n.reference.endsWith("-delivery")),
          }),
        ),
      );
      expect(notesOf(again.documents)).toEqual([]);
      const wrong = projectShopRefundSettled(
        facts({
          order: outsideUk(),
          registeredDelivery: first.filter((n) => !n.reference.endsWith("-delivery")),
        }),
      );
      expect(wrong.ok ? null : wrong.refusal.code).toBe("bad_facts");
    });
  });
});

describe("buildCreditNoteFor on named lines", () => {
  const invoiceOf = () => {
    const built = shopOrderInvoice(order());
    if (!built.ok) throw new Error(built.refusal.message);
    return built.value.invoice;
  };
  const input = (over: Partial<Parameters<typeof buildCreditNoteFor>[1]> = {}) => ({
    sourceId: R1,
    issuedOn: "2026-11-13",
    buckets: {
      paidGoodsPence: 57_000,
      paidDeliveryPence: 2_500,
      refundedGoodsPence: 0,
      refundedDeliveryPence: 0,
    },
    request: { goodsPence: 12_000, deliveryPence: 0 },
    priorCredits: [],
    lines: [1],
    ...over,
  });

  it("credits only the named line, and the replay finds it there", () => {
    const invoice = invoiceOf();
    const note = must(buildCreditNoteFor(invoice, input()));
    expect(note.lines.map((l) => l.description)).toEqual(["Credit: Framing: Natural oak"]);
    expect(must(creditedOnInvoiceLines(invoice, [note]))).toEqual([0, 12_000, 0]);
  });

  it("refuses more than is left on the named line, never spilling onto another", () => {
    const result = buildCreditNoteFor(
      invoiceOf(),
      input({ request: { goodsPence: 12_001, deliveryPence: 0 } }),
    );
    expect(result.ok ? null : result.refusal.code).toBe("exceeds_invoice");
  });

  it("refuses a request of the other role, or lines of two roles", () => {
    const delivery = buildCreditNoteFor(
      invoiceOf(),
      input({ request: { goodsPence: 0, deliveryPence: 100 } }),
    );
    expect(delivery.ok ? null : delivery.refusal.code).toBe("exceeds_invoice");
    const mixed = buildCreditNoteFor(invoiceOf(), input({ lines: [1, 2] }));
    expect(mixed.ok ? null : mixed.refusal.code).toBe("bad_line");
  });
});

describe("Shop refund reversed after it succeeded (review F2)", () => {
  it("is built and wired as its own flow, with #1375's reversal policy", () => {
    expect(BUILT_FLOWS).toContain("shop_refund_reversed");
    expect(PROJECTION_POLICIES.shop_refund_reversed).toBe(projectShopRefundReversed);
  });

  it("cancels a note never sent and holds an issued one for a person", () => {
    const result = must(
      projectShopRefundReversed({
        reversed: [
          { reference: `LAX-SHOP-CN-${R1}`, standing: "waiting" },
          { reference: `LAX-SHOP-CN-${R2}`, standing: "issued" },
          { reference: `LAX-SHOP-CN-${R3}`, standing: "absent" },
        ],
      }),
    );
    expect(result.documents).toEqual([]);
    expect(result.cancel).toEqual([`LAX-SHOP-CN-${R1}`]);
    expect(result.hold).toEqual([
      { reference: `LAX-SHOP-CN-${R2}`, reason: "refund_reversed_after_credit" },
    ]);
  });
});
