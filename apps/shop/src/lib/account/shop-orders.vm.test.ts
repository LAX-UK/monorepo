import type { OrderStatus, OrderSummary } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  buildShopOrderDetailVm,
  buildShopOrderLines,
  buildShopOrderListVm,
  buildShopOrderTimeline,
  buildShopOrderTotals,
  isPlacedShopOrder,
  shopOrderProgressStatus,
  shopOrderTitle,
} from "./shop-orders.vm";

const NOW = new Date("2026-10-20T09:10:00.000Z");

let seq = 0;
function order(status: OrderStatus, overrides: Partial<OrderSummary> = {}): OrderSummary {
  seq += 1;
  const id = `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
  return {
    orderId: id,
    reference: `LAX-S-${10_000 + seq}`,
    status,
    fulfilment: "uk_insured_delivery",
    merchandiseSubtotalPence: 8500,
    fulfilmentSurchargePence: 1500,
    totalPence: 10000,
    lines: [
      {
        orderLineId: id,
        artworkSlug: "harbor-print",
        artworkTitle: "Harbor Print",
        artistName: "Juno Frost",
        productVariantId: null,
        productSlug: null,
        productTitle: null,
        variantSku: null,
        editionNumber: 7,
        editionSize: 24,
        unitPricePence: 8500,
        imageUrl: "https://cdn.example/harbor.webp",
      },
    ],
    createdAt: "2026-10-14T21:31:00.000Z",
    paidAt: status === "pending_payment" ? null : "2026-10-14T21:33:00.000Z",
    deliveryAddress: {
      recipientName: "Robert Thorne",
      line1: "12 Elm Row",
      city: "Edinburgh",
      postcode: "EH7 4AA",
      country: "GB",
    },
    vatIncludedPence: 1667,
    vatRateBp: 2000,
    progress: null,
    refunds: [],
    problemReport: { open: status === "paid", endsAt: null },
    invoiceAvailable: status !== "pending_payment",
    ...overrides,
  };
}

const progress = (
  overrides: Partial<NonNullable<OrderSummary["progress"]>>,
): NonNullable<OrderSummary["progress"]> => ({
  status: "pending_production",
  carrier: null,
  trackingNumber: null,
  trackingUrl: null,
  productionStartedAt: null,
  dispatchedAt: null,
  readyForCollectionAt: null,
  possessionAt: null,
  cancelledAt: null,
  ...overrides,
});

describe("isPlacedShopOrder", () => {
  it("keeps orders that were paid, whatever happened after", () => {
    for (const status of ["paid", "partially_refunded", "refunded"] as const) {
      expect(isPlacedShopOrder(order(status))).toBe(true);
    }
    expect(isPlacedShopOrder(order("cancelled"))).toBe(true);
  });

  it("leaves out checkout attempts that never took payment", () => {
    expect(isPlacedShopOrder(order("pending_payment"))).toBe(false);
    expect(isPlacedShopOrder(order("expired", { paidAt: null }))).toBe(false);
    expect(isPlacedShopOrder(order("payment_failed", { paidAt: null }))).toBe(false);
    expect(isPlacedShopOrder(order("cancelled", { paidAt: null }))).toBe(false);
  });
});

describe("buildShopOrderListVm", () => {
  it("has no rows when every order is an abandoned checkout", () => {
    expect(
      buildShopOrderListVm(
        [order("expired", { paidAt: null }), order("cancelled", { paidAt: null })],
        NOW,
      ),
    ).toEqual({ deliveryQuote: null, finishPaying: null, rows: [] });
  });

  it("lists paid orders newest first with their reference, date, total and where they are", () => {
    const older = order("paid", { createdAt: "2026-09-01T10:00:00.000Z" });
    const newer = order("paid", {
      createdAt: "2026-10-18T09:00:00.000Z",
      progress: progress({ status: "in_transit" }),
    });
    const vm = buildShopOrderListVm([older, order("expired", { paidAt: null }), newer], NOW);
    expect(vm.rows.map((row) => row.orderId)).toEqual([newer.orderId, older.orderId]);
    const [first] = vm.rows;
    expect(first).toMatchObject({
      title: "Harbor Print",
      reference: newer.reference,
      placedLabel: "18 Oct 2026",
      totalLabel: "£100.00",
      status: { label: "Dispatched" },
      thumbnailUrl: "https://cdn.example/harbor.webp",
      href: `/account/orders/${newer.orderId}`,
    });
  });

  it("offers the newest payable checkout once, and drops it when its reservation ran out", () => {
    const payable = order("pending_payment", {
      createdAt: "2026-10-20T09:00:00.000Z",
      checkoutExpiresAt: "2026-10-20T09:30:00.000Z",
    });
    const lapsed = order("pending_payment", {
      createdAt: "2026-10-19T09:00:00.000Z",
      checkoutExpiresAt: "2026-10-19T09:30:00.000Z",
    });
    const vm = buildShopOrderListVm([lapsed, payable, order("paid")], NOW);
    expect(vm.rows).toHaveLength(1);
    expect(vm.finishPaying).toMatchObject({
      orderId: payable.orderId,
      totalLabel: "£100.00",
      reservedLabel: "Your editions are reserved until 10:30.",
    });
    expect(buildShopOrderListVm([lapsed], NOW).finishPaying).toBeNull();
  });

  describe("a delivery quote outside the UK", () => {
    const quoteOrder = (
      deliveryQuote: NonNullable<OrderSummary["deliveryQuote"]>,
      overrides: Partial<OrderSummary> = {},
    ) =>
      order("pending_payment", {
        fulfilment: "international_quotation",
        fulfilmentSurchargePence: 0,
        merchandiseSubtotalPence: 8500,
        totalPence: 8500,
        createdAt: "2026-10-20T09:00:00.000Z",
        checkoutExpiresAt: "2026-10-23T09:00:00.000Z",
        deliveryQuote,
        ...overrides,
      });
    const waiting = {
      status: "requested" as const,
      country: "DE",
      pricePence: null,
      carrier: null,
      service: null,
      leadTimeNote: null,
      holdUntil: "2026-10-23T09:00:00.000Z",
      paymentOpen: true,
    };
    const priced = {
      ...waiting,
      status: "quoted" as const,
      pricePence: 8500,
      carrier: "DHL Express",
      service: "Express insured",
      leadTimeNote: "Usually 5 to 7 working days.",
    };

    it("says it is pricing the delivery, and offers no way to pay yet", () => {
      const vm = buildShopOrderListVm([quoteOrder(waiting)], NOW);
      expect(vm.deliveryQuote).toMatchObject({
        stage: "waiting",
        place: "Germany",
        heldUntilLabel: "23 October 2026",
        price: null,
      });
      expect(vm.finishPaying).toBeNull();
    });

    it("shows the price, the courier and the total with the print once quoted", () => {
      const vm = buildShopOrderListVm([quoteOrder(priced)], NOW);
      expect(vm.deliveryQuote).toMatchObject({
        stage: "ready",
        canPay: true,
        price: {
          deliveryLabel: "£85.00",
          totalLabel: "£170.00",
          carrierLabel: "DHL Express (Express insured)",
          leadTimeNote: "Usually 5 to 7 working days.",
        },
      });
      expect(vm.finishPaying).toBeNull();
    });

    it("carries whether payment is open, so the page can say it is not yet", () => {
      const vm = buildShopOrderListVm([quoteOrder({ ...priced, paymentOpen: false })], NOW);
      expect(vm.deliveryQuote?.canPay).toBe(false);
    });

    it("pays an accepted quote like any unpaid order", () => {
      const vm = buildShopOrderListVm([quoteOrder({ ...priced, status: "accepted" })], NOW);
      expect(vm.deliveryQuote).toBeNull();
      expect(vm.finishPaying).not.toBeNull();
    });

    it("drops the quote once the hold has run out", () => {
      const lapsed = quoteOrder(priced, { checkoutExpiresAt: "2026-10-20T09:00:00.000Z" });
      expect(buildShopOrderListVm([lapsed], NOW).deliveryQuote).toBeNull();
    });

    it("leads the order page with the quote and no 'not paid' notice", () => {
      const vm = buildShopOrderDetailVm(quoteOrder(priced), NOW);
      expect(vm.deliveryQuote?.stage).toBe("ready");
      expect(vm.notice).toBeNull();
    });
  });

  it("summarises multi-item orders and shows refunds", () => {
    const base = order("partially_refunded", { refundedPence: 4000 });
    const [line] = base.lines;
    if (!line) throw new Error("fixture");
    const vm = buildShopOrderListVm(
      [{ ...base, lines: [line, { ...line, orderLineId: "x", artworkTitle: "Reed Study" }] }],
      NOW,
    );
    expect(vm.rows[0]?.title).toBe("Harbor Print and 1 more");
    expect(vm.rows[0]?.refundLabel).toBe("£40.00 refunded");
    expect(vm.rows[0]?.status.label).toBe("Partly refunded");
  });

  it("names an order from an older shop-api by its date", () => {
    const { reference: _drop, ...legacy } = order("paid");
    expect(buildShopOrderListVm([legacy], NOW).rows[0]?.reference).toBe("from 14 Oct 2026");
  });
});

describe("shopOrderProgressStatus", () => {
  it("follows delivery and collection", () => {
    expect(shopOrderProgressStatus(order("paid")).label).toBe("Paid");
    expect(
      shopOrderProgressStatus(order("paid", { progress: progress({ status: "in_production" }) }))
        .label,
    ).toBe("In production");
    expect(
      shopOrderProgressStatus(order("paid", { progress: progress({ status: "delivered" }) })).label,
    ).toBe("Delivered");
    expect(
      shopOrderProgressStatus(
        order("paid", {
          fulfilment: "collect_new_cavendish",
          progress: progress({ status: "ready_for_collection" }),
        }),
      ).label,
    ).toBe("Ready to collect");
  });

  it("says cancelled or refunded once that happens", () => {
    expect(
      shopOrderProgressStatus(
        order("partially_refunded", {
          refunds: [
            {
              amountPence: 10000,
              kind: "cancellation",
              status: "pending",
              requestedAt: "2026-10-16T10:00:00.000Z",
              refundedAt: null,
            },
          ],
        }),
      ).label,
    ).toBe("Cancelled");
    expect(shopOrderProgressStatus(order("refunded")).label).toBe("Refunded");
  });
});

describe("buildShopOrderTimeline", () => {
  it("dates each reached stage, marks the next one and shows tracking once dispatched", () => {
    const steps = buildShopOrderTimeline(
      order("paid", {
        progress: progress({
          status: "in_transit",
          carrier: "Royal Mail",
          trackingNumber: "AB123456789GB",
          trackingUrl: "https://www.royalmail.com/track-your-item#/tracking-results/AB123456789GB",
          productionStartedAt: "2026-10-15T09:00:00.000Z",
          dispatchedAt: "2026-10-16T14:00:00.000Z",
        }),
      }),
    );
    expect(steps?.map((step) => [step.label, step.state])).toEqual([
      ["Ordered", "done"],
      ["Paid", "done"],
      ["In production", "done"],
      ["Dispatched", "done"],
      ["Delivered", "next"],
    ]);
    const dispatched = steps?.find((step) => step.id === "dispatched");
    expect(dispatched).toMatchObject({
      dateLabel: "16 Oct 2026, 15:00",
      detail: "Royal Mail · Tracking number AB123456789GB",
      link: { label: "Track parcel" },
    });
  });

  it("uses collection stages for a collection order", () => {
    const steps = buildShopOrderTimeline(
      order("paid", {
        fulfilment: "collect_new_cavendish",
        deliveryAddress: null,
        progress: progress({ status: "collected", possessionAt: "2026-10-18T11:00:00.000Z" }),
      }),
    );
    expect(steps?.map((step) => step.label)).toEqual([
      "Ordered",
      "Paid",
      "In production",
      "Ready to collect",
      "Collected",
    ]);
    // A stage reached before its date was recorded shows no date rather than a guess.
    expect(steps?.find((step) => step.id === "ready")).toMatchObject({
      state: "done",
      dateLabel: null,
    });
  });

  it("ends at a cancellation and adds the refund", () => {
    const steps = buildShopOrderTimeline(
      order("refunded", {
        progress: progress({
          status: "cancelled",
          productionStartedAt: "2026-10-15T09:00:00.000Z",
          cancelledAt: "2026-10-16T09:00:00.000Z",
        }),
        refunds: [
          {
            amountPence: 10000,
            kind: "cancellation",
            status: "succeeded",
            requestedAt: "2026-10-16T09:00:00.000Z",
            refundedAt: "2026-10-17T09:00:00.000Z",
          },
        ],
      }),
    );
    expect(steps?.map((step) => [step.label, step.state])).toEqual([
      ["Ordered", "done"],
      ["Paid", "done"],
      ["In production", "done"],
      ["Cancelled", "done"],
      ["Refunded £100.00", "done"],
    ]);
  });

  it("shows a reported problem with its date", () => {
    const steps = buildShopOrderTimeline(
      order("paid", { problemReports: [{ reportedAt: "2026-10-26T09:00:00.000Z" }] }),
    );
    expect(steps?.at(-1)).toMatchObject({
      label: "Problem reported",
      state: "done",
      dateLabel: "26 Oct 2026, 09:00",
      detail: "Our team will reply by email.",
    });
  });

  it("has no timeline for a checkout that was never paid", () => {
    expect(buildShopOrderTimeline(order("expired", { paidAt: null }))).toBeNull();
  });
});

describe("buildShopOrderTotals", () => {
  it("states delivery, the total and the VAT included once", () => {
    expect(buildShopOrderTotals(order("paid"))).toEqual({
      rows: [
        { label: "Items", value: "£85.00" },
        { label: "UK insured delivery", value: "£15.00" },
        { label: "Total", value: "£100.00", emphasis: true },
      ],
      vatLine: "Includes VAT of £16.67",
    });
  });

  it("shows free collection and no VAT line where none was recorded", () => {
    const totals = buildShopOrderTotals(
      order("paid", {
        fulfilment: "collect_new_cavendish",
        fulfilmentSurchargePence: 0,
        vatIncludedPence: null,
      }),
    );
    expect(totals.rows[1]).toEqual({ label: "Collect from our London gallery", value: "Free" });
    expect(totals.vatLine).toBeNull();
  });
});

describe("a framed order", () => {
  const framed = () => {
    const base = order("paid");
    const [print] = base.lines;
    if (!print) throw new Error("fixture has a line");
    return {
      ...base,
      framingSubtotalPence: 21_000,
      totalPence: 121_000,
      lines: [
        print,
        {
          ...print,
          orderLineId: "00000000-0000-4000-8000-0000000000f1",
          kind: "framing" as const,
          framingName: "Natural oak frame",
          framingFor: "Harbor Print, no. 3",
          framingForLineId: print.orderLineId,
          framingDetail: "Window mount, white conservation board · UV-filtering acrylic",
          artworkTitle: null,
          artworkSlug: null,
          artistName: null,
          editionNumber: null,
          editionSummary: null,
          unitPricePence: 21_000,
        },
      ],
    };
  };

  it("shows the frame under its print as 'Framing: <name>', at its own price", () => {
    const rows = buildShopOrderLines(framed());
    expect(rows).toHaveLength(1);
    expect(rows[0]?.framing).toEqual({
      label: "Framing: Natural oak frame",
      detail: "Window mount, white conservation board · UV-filtering acrylic",
      priceLabel: "£210.00",
    });
  });

  it("keeps a frame whose print is not in the list as a row of its own", () => {
    const placed = framed();
    const rows = buildShopOrderLines({ ...placed, lines: placed.lines.slice(1) });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ title: "Framing: Natural oak frame", href: null });
  });

  it("totals the framing on its own row between items and delivery", () => {
    expect(buildShopOrderTotals(framed()).rows.map((row) => row.label)).toEqual([
      "Items",
      "Framing",
      "UK insured delivery",
      "Total",
    ]);
  });

  it("is still titled by the print, not 'and 1 more'", () => {
    expect(shopOrderTitle(framed())).not.toContain("more");
  });
});

describe("buildShopOrderDetailVm", () => {
  it("is titled by the reference and lists the recipient first in the address", () => {
    const placed = order("paid");
    const vm = buildShopOrderDetailVm(placed, NOW);
    expect(vm.title).toBe(`Order ${placed.reference}`);
    expect(vm.delivery).toEqual({
      method: "UK insured delivery",
      lines: ["Robert Thorne", "12 Elm Row", "Edinburgh EH7 4AA", "United Kingdom"],
    });
    expect(vm.invoiceHref).toBe(`/account/orders/${placed.orderId}/invoice`);
    expect(vm.problem).toEqual({
      kind: "open",
      href: `/account/orders/${placed.orderId}/report-a-problem`,
      until: null,
    });
  });

  it("names the edition only while a paid order holds it", () => {
    expect(buildShopOrderDetailVm(order("paid"), NOW).lines[0]?.edition).toBe("Edition 7 of 24");
    // An older shop-api may still send the number; the page never shows it on these.
    for (const status of ["cancelled", "pending_payment", "refunded"] as const) {
      expect(buildShopOrderDetailVm(order(status), NOW).lines[0]?.edition).toBe("Edition of 24");
    }
  });

  it("describes the print from the facts the buyer paid under", () => {
    const summary = "No. 7 of 24 · Hand-signed · Certificate from the artist";
    const described = order("paid");
    const [line] = described.lines;
    if (!line) throw new Error("fixture has a line");
    const withSummary = { ...described, lines: [{ ...line, editionSummary: summary }] };
    expect(buildShopOrderDetailVm(withSummary, NOW).lines[0]?.edition).toBe(summary);
  });

  it("shows an unnumbered print without a number", () => {
    const described = order("paid");
    const [line] = described.lines;
    if (!line) throw new Error("fixture has a line");
    const open = {
      ...described,
      lines: [
        {
          ...line,
          editionNumber: null,
          editionSize: null,
          editionSummary: "Open edition · Unsigned",
        },
      ],
    };
    expect(buildShopOrderDetailVm(open, NOW).lines[0]?.edition).toBe("Open edition · Unsigned");
  });

  it("says when the window to report a problem closed", () => {
    const vm = buildShopOrderDetailVm(
      order("paid", { problemReport: { open: false, endsAt: "2026-11-18T10:00:00.000Z" } }),
      NOW,
    );
    expect(vm.problem).toEqual({ kind: "closed", endedOn: "18 Nov 2026" });
    expect(buildShopOrderDetailVm(order("refunded"), NOW).problem).toBeNull();
  });

  it("explains an unpaid order instead of a timeline", () => {
    const lapsed = buildShopOrderDetailVm(
      order("pending_payment", { checkoutExpiresAt: "2026-10-19T09:30:00.000Z" }),
      NOW,
    );
    expect(lapsed.timeline).toBeNull();
    expect(lapsed.finishPaying).toBeNull();
    expect(lapsed.notice).toBe("The time to pay for this order has run out.");
    expect(lapsed.invoiceHref).toBeNull();
  });
});
