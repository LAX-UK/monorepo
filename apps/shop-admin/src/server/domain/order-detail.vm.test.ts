import type { AdminOrderDetail } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  buildOrderTimeline,
  canRefundOrder,
  cancelAfterPossessionDescription,
  cancelledLineBadge,
  failedRefunds,
  fulfilmentNextOptions,
  lineCancellation,
  lineCancellationRefund,
  orderLineLabel,
  presentFulfilmentStatus,
  presentOrderStatus,
  productionCandidateLines,
  refundRowContext,
  refundTargetOptions,
  refundableRemainingPence,
  settledOutsideNote,
} from "./order-detail.vm";

const LINE_A = "11111111-0000-4000-8000-000000000001";
const LINE_B = "22222222-0000-4000-8000-000000000002";

function order(overrides: Partial<AdminOrderDetail> = {}): AdminOrderDetail {
  return {
    orderId: "d701e66d-0000-4000-8000-000000000000",
    status: "paid",
    fulfilment: "uk_insured_delivery",
    totalPence: 100_000,
    buyerSubjectId: "buyer",
    buyerName: "Robert Thorne",
    buyerEmail: "robert@example.com",
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    paidAt: "2026-10-14T21:31:00.000Z",
    createdAt: "2026-10-14T21:29:00.000Z",
    lines: [
      {
        orderLineId: LINE_A,
        artworkId: "a1",
        artworkTitle: "Marylebone at dusk",
        productTitle: null,
        sku: null,
        editionId: "e1",
        editionNumber: 12,
        unitPricePence: 60_000,
        sellerPartyId: null,
        production: null,
      },
      {
        orderLineId: LINE_B,
        artworkId: null,
        artworkTitle: null,
        productTitle: "Linen tote",
        sku: "TOTE",
        editionId: null,
        editionNumber: null,
        unitPricePence: 40_000,
        sellerPartyId: null,
        production: null,
      },
    ],
    fulfilmentRecord: null,
    refunds: [],
    activity: [],
    ...overrides,
  };
}

describe("order statuses", () => {
  it("maps each domain status to a label and tone", () => {
    expect(presentOrderStatus("paid")).toEqual({ label: "Paid", tone: "success" });
    expect(presentFulfilmentStatus("in_transit").label).toBe("In transit");
    expect(presentFulfilmentStatus("lost_in_space")).toEqual({
      label: "Lost in space",
      tone: "neutral",
    });
  });
});

describe("refunds", () => {
  it("caps a line refund at the line price less what was already refunded", () => {
    const detail = order({
      refunds: [
        {
          refundId: "r1",
          orderLineId: LINE_A,
          amountPence: 10_000,
          status: "succeeded",
          source: "admin",
          createdAt: "2026-10-15T00:00:00Z",
        },
        {
          refundId: "r2",
          orderLineId: LINE_A,
          amountPence: 5_000,
          status: "failed",
          source: "admin",
          createdAt: "2026-10-15T00:00:00Z",
        },
      ],
    });
    expect(refundableRemainingPence(detail, LINE_A)).toBe(50_000);
    expect(refundableRemainingPence(detail, null)).toBe(90_000);
  });

  it("only offers refunds on paid orders with money left", () => {
    expect(canRefundOrder(order())).toBe(true);
    expect(canRefundOrder(order({ status: "pending_payment" }))).toBe(false);
    expect(
      canRefundOrder(
        order({
          refunds: [
            {
              refundId: "r",
              orderLineId: null,
              amountPence: 100_000,
              status: "pending",
              source: "admin",
              createdAt: "2026-10-15T00:00:00Z",
            },
          ],
        }),
      ),
    ).toBe(false);
  });
});

describe("fulfilmentNextOptions", () => {
  it("offers only the moves the fulfilment rules allow", () => {
    expect(fulfilmentNextOptions("awaiting_dispatch").map((option) => option.value)).toEqual([
      "in_transit",
      "ready_for_collection",
      "in_storage",
      "cancelled",
    ]);
    expect(fulfilmentNextOptions("delivered")).toEqual([]);
    expect(fulfilmentNextOptions("something_new")).toEqual([]);
  });
});

describe("production", () => {
  it("offers lines with an edition and no task yet", () => {
    expect(productionCandidateLines(order()).map((line) => line.orderLineId)).toEqual([LINE_A]);
  });

  it("names lines by title and edition, never by id", () => {
    const [art, tote] = order().lines;
    expect(orderLineLabel(art as AdminOrderDetail["lines"][number])).toBe(
      "Marylebone at dusk, edition 12",
    );
    expect(orderLineLabel(tote as AdminOrderDetail["lines"][number])).toBe("Linen tote");
  });
});

describe("buildOrderTimeline", () => {
  it("merges staff actions with placed and paid, newest first, in sentences", () => {
    const events = buildOrderTimeline(
      order({
        activity: [
          {
            auditId: "a1",
            action: "request_refund",
            targetType: "shop_refund",
            actorSubjectId: "s1",
            actorName: "Maya Okafor",
            createdAt: "2026-10-18T09:45:00.000Z",
            detail: { amountPence: 1500, reason: "damaged_in_transit", note: "Torn" },
          },
          {
            auditId: "a2",
            action: "update_fulfilment",
            targetType: "shop_fulfilment",
            actorSubjectId: "s2",
            actorName: null,
            createdAt: "2026-10-20T10:12:00.000Z",
            detail: { status: "in_transit", carrier: "Royal Mail", trackingNumber: "RM123" },
          },
        ],
      }),
    );
    expect(events.map((event) => event.title)).toEqual([
      "Fulfilment moved to in transit",
      "Refund of £15.00 requested",
      "Paid £1,000.00",
      "Order placed",
    ]);
    expect(events[0]?.actor).toBe("Staff");
    expect(events[0]?.detail).toBe("Tracking Royal Mail RM123");
    expect(events[1]?.detail).toBe("Damaged in transit — Torn");
    expect(events[3]?.actor).toBe("Robert Thorne");
  });
});

describe("timeline entries for returns and outside refunds", () => {
  const entry = (action: string, detail: Record<string, unknown> | null) =>
    buildOrderTimeline(
      order({
        activity: [
          {
            auditId: `a-${action}`,
            action,
            targetType: "shop_refund",
            actorSubjectId: "s1",
            actorName: "Maya Okafor",
            createdAt: "2026-10-30T09:45:00.000Z",
            detail,
          },
        ],
      }),
    )[0];

  it("reads a refund marked as refunded outside LAX with its reference and reason", () => {
    const event = entry("refund_settled_outside", {
      amountPence: 6000,
      reference: "re_3Qdashboard",
      reason: "Refunded in the dashboard",
    });
    expect(event?.title).toBe("Refund of £60.00 marked as refunded outside LAX");
    expect(event?.detail).toBe("Reference re_3Qdashboard — Refunded in the dashboard");
  });

  it("reads the stages of a return in words", () => {
    expect(entry("return_in_transit", null)?.title).toBe("Return marked in transit");
    expect(entry("return_received", { disposition: "back_on_sale" })?.title).toBe(
      "Return received and put back on sale",
    );
    expect(entry("return_received", { disposition: "withdrawn_damaged" })?.title).toBe(
      "Return received and withdrawn",
    );
  });

  it("says whether a cancelled print is back on sale or has to come back first", () => {
    expect(entry("cancel_after_possession", { stock: "restocked" })?.detail).toContain(
      "back on sale",
    );
    expect(entry("cancel_after_possession", { stock: "awaiting_return" })?.detail).toContain(
      "comes back to the gallery",
    );
  });
});

describe("cancelling an item after possession", () => {
  const cancellation = (
    status: string,
    overrides: Partial<AdminOrderDetail["refunds"][number]> = {},
  ): AdminOrderDetail["refunds"][number] => ({
    refundId: "c1",
    orderLineId: LINE_A,
    amountPence: 60_000,
    status,
    source: "cancellation",
    createdAt: "2026-10-15T00:00:00Z",
    ...overrides,
  });
  const [lineA, lineB] = order().lines as [
    AdminOrderDetail["lines"][number],
    AdminOrderDetail["lines"][number],
  ];

  it("states the refund the system makes, so staff never repeat it", () => {
    expect(lineCancellation(order(), lineA)).toMatchObject({ refundPence: 60_000 });
    const copy = cancelAfterPossessionDescription(60_000, "await_return");
    expect(copy).toContain("refunds £600.00 for this item to the customer's card");
    expect(copy).not.toMatch(/separately/i);
  });

  it("offers no cancellation once the item has been cancelled, whatever its refund's state", () => {
    for (const status of ["pending", "succeeded", "failed"]) {
      expect(lineCancellation(order({ refunds: [cancellation(status)] }), lineA)).toBeNull();
    }
    expect(lineCancellation(order({ refunds: [cancellation("pending")] }), lineB)).toMatchObject({
      refundPence: 40_000,
    });
  });

  it("says what happens to the print: back on sale at once, or tracked as a return", () => {
    expect(cancelAfterPossessionDescription(60_000, "restock_now")).toContain(
      "never left the gallery, so it goes back on sale straight away",
    );
    expect(cancelAfterPossessionDescription(60_000, "await_return")).toContain(
      "goes back on sale when you receive it",
    );
  });

  it("reads the stock outcome from where the item is, and assumes it left when unknown", () => {
    const at = (status: string | null) =>
      order({
        fulfilmentRecord: status
          ? {
              fulfilmentId: "00000000-0000-4000-8000-0000000000f1",
              status,
              option: "uk_insured_delivery",
              carrier: null,
              trackingNumber: null,
              updatedAt: "2026-10-15T00:00:00Z",
            }
          : null,
      });
    expect(lineCancellation(at("in_storage"), lineA)?.stock).toBe("restock_now");
    expect(lineCancellation(at("delivered"), lineA)?.stock).toBe("await_return");
    expect(lineCancellation(at(null), lineA)?.stock).toBe("await_return");
  });

  it("offers no cancellation on an order that is not paid", () => {
    expect(lineCancellation(order({ status: "refunded" }), lineA)).toBeNull();
  });

  it("keeps the whole-order balance clear of a cancelled item whose refund failed", () => {
    const detail = order({ refunds: [cancellation("failed")] });
    expect(refundableRemainingPence(detail, null)).toBe(40_000);
    expect(refundableRemainingPence(detail, LINE_A)).toBe(0);
  });

  it("finds the refund that belongs to a cancelled line and labels it by state", () => {
    const detail = order({ refunds: [cancellation("pending")] });
    expect(lineCancellationRefund(detail, LINE_A)?.refundId).toBe("c1");
    expect(lineCancellationRefund(detail, LINE_B)).toBeNull();
    expect(
      lineCancellationRefund(order({ refunds: [cancellation("cancelled")] }), LINE_A),
    ).toBeNull();
    expect(cancelledLineBadge(cancellation("pending"))).toEqual({
      label: "Cancelled, refund pending",
      tone: "warning",
    });
    expect(cancelledLineBadge(cancellation("succeeded")).label).toBe("Cancelled, refunded");
    expect(cancelledLineBadge(cancellation("failed"))).toEqual({
      label: "Cancelled, refund failed",
      tone: "danger",
    });
  });

  it("says the whole order leaves cancelled items out", () => {
    expect(refundTargetOptions(order())[0]?.description).not.toContain("excluded");
    expect(
      refundTargetOptions(order({ refunds: [cancellation("pending")] }))[0]?.description,
    ).toContain("cancelled items excluded");
  });

  it("describes where a refund came from", () => {
    expect(refundRowContext(cancellation("pending"), lineA)).toContain(
      "Marylebone at dusk, edition 12 · Cancelled after possession",
    );
    expect(refundRowContext(cancellation("pending", { source: "admin" }), undefined)).toContain(
      "Whole order · Admin",
    );
  });
});

describe("failed refunds", () => {
  it("lists only the refunds waiting for a retry", () => {
    const detail = order({
      refunds: [
        {
          refundId: "f1",
          orderLineId: null,
          amountPence: 1_000,
          status: "failed",
          source: "admin",
          createdAt: "2026-10-15T00:00:00Z",
          failureReason: "charge_already_refunded",
        },
        {
          refundId: "p1",
          orderLineId: null,
          amountPence: 1_000,
          status: "pending",
          source: "admin",
          createdAt: "2026-10-15T00:00:00Z",
        },
      ],
    });
    expect(failedRefunds(detail).map((refund) => refund.refundId)).toEqual(["f1"]);
  });

  it("shows a retried refund on the timeline", () => {
    const events = buildOrderTimeline(
      order({
        activity: [
          {
            auditId: "a1",
            action: "retry_refund",
            targetType: "shop_refund",
            actorSubjectId: "s",
            actorName: "Finance",
            createdAt: "2026-10-16T00:00:00Z",
            detail: { amountPence: 60_000 },
          },
        ],
      }),
    );
    expect(events.find((event) => event.id === "a1")?.title).toBe("Refund of £600.00 sent again");
  });
});

describe("a refund settled outside LAX", () => {
  const settled: AdminOrderDetail["refunds"][number] = {
    refundId: "c9",
    orderLineId: LINE_A,
    amountPence: 60_000,
    status: "succeeded",
    source: "cancellation",
    createdAt: "2026-10-15T00:00:00Z",
    settledOutside: {
      reference: "re_3Qdashboard",
      reason: "Refunded in the dashboard",
      at: "2026-10-30T09:45:00.000Z",
      byName: "Maya Okafor",
    },
  };

  it("names it as refunded outside LAX instead of how it was first requested", () => {
    expect(refundRowContext(settled, undefined)).toContain("Refunded outside LAX");
  });

  it("notes the reference, who recorded it and why", () => {
    const note = settledOutsideNote(settled);
    expect(note).toContain("Reference re_3Qdashboard");
    expect(note).toContain("by Maya Okafor");
    expect(note).toContain("Refunded in the dashboard");
    expect(settledOutsideNote({ ...settled, settledOutside: null })).toBeNull();
  });
});
