import { describe, expect, it } from "vitest";
import type { CreditNote } from "../document.js";
import { lineGrossPence } from "../money.js";
import { BUILT_FLOWS, PROJECTION_POLICIES } from "./flows.js";
import {
  type ShopRefundFacts,
  type ShopRefundsFacts,
  projectShopRefundSettled,
  shopCreditBuiltAfter,
} from "./shop-refunds.js";
import type { ShopOrderPaidFacts } from "./shop.js";

const ORDER_ID = "5b6a7c1e-1111-4a5b-8c9d-000000000001";
const PARTY_ID = "5b6a7c1e-2222-4a5b-8c9d-000000000002";
const PRINT_LINE = "5b6a7c1e-3333-4a5b-8c9d-000000000003";
const FRAME_LINE = "5b6a7c1e-4444-4a5b-8c9d-000000000004";
const R1 = "5b6a7c1e-5555-4a5b-8c9d-000000000001";
const R2 = "5b6a7c1e-5555-4a5b-8c9d-000000000002";
const R3 = "5b6a7c1e-5555-4a5b-8c9d-000000000003";

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

  it("refuses a line's refund that its line's place cannot take (the frame before the print)", () => {
    const result = projectShopRefundSettled(
      facts({ refunds: [refund(R1, { amountPence: 12_000, orderLineId: FRAME_LINE })] }),
    );
    expect(result.ok ? null : result.refusal.code).toBe("refund_unattributed");
  });

  it("leaves out an earlier refund that waits for staff, and credits this event's own", () => {
    const { documents } = must(
      projectShopRefundSettled(
        facts({
          refunds: [refund(R1, { amountPence: 10_000, orderLineId: null }), refund(R2)],
          refundId: R2,
        }),
      ),
    );
    expect(notesOf(documents).map((n) => n.reference)).toEqual([`LAX-SHOP-CN-${R2}`]);
  });

  it("keeps a registered credit note as stored and credits the next line after it", () => {
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
    const notes = notesOf(documents);
    expect(notes.map((n) => n.reference)).toEqual([`LAX-SHOP-CN-${R2}`]);
    expect(notes[0]?.lines.map((l) => l.description)).toEqual(["Credit: Framing: Natural oak"]);
  });

  it("credits the second line's refund recorded first once the first line's is credited", () => {
    const { documents } = must(
      projectShopRefundSettled(
        facts({
          refunds: [refund(R1, { amountPence: 12_000, orderLineId: FRAME_LINE }), refund(R2)],
          refundId: R1,
        }),
      ),
    );
    expect(notesOf(documents).map((n) => [n.reference, n.lines[0]?.description])).toEqual([
      [`LAX-SHOP-CN-${R2}`, "Credit: Harbour at dusk · Edition 7 of 24"],
      [`LAX-SHOP-CN-${R1}`, "Credit: Framing: Natural oak"],
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
});
