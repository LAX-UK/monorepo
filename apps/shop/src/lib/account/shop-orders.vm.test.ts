import type { OrderStatus, OrderSummary } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { buildShopOrderDetailVm, buildShopOrderListVm, isPlacedShopOrder } from "./shop-orders.vm";

let seq = 0;
function order(status: OrderStatus, overrides: Partial<OrderSummary> = {}): OrderSummary {
  seq += 1;
  const id = `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
  return {
    orderId: id,
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
        productVariantId: null,
        productSlug: null,
        productTitle: null,
        variantSku: null,
        editionNumber: 7,
        unitPricePence: 8500,
        imageUrl: "https://cdn.example/harbor.webp",
      },
    ],
    createdAt: "2026-10-14T21:31:00.000Z",
    paidAt: status === "pending_payment" ? null : "2026-10-14T21:33:00.000Z",
    deliveryAddress: null,
    ...overrides,
  };
}

describe("isPlacedShopOrder", () => {
  it("keeps paid, refunded and awaiting-payment orders", () => {
    for (const status of ["paid", "partially_refunded", "refunded", "pending_payment"] as const) {
      expect(isPlacedShopOrder(order(status))).toBe(true);
    }
  });

  it("leaves out checkout attempts that never took payment", () => {
    expect(isPlacedShopOrder(order("expired", { paidAt: null }))).toBe(false);
    expect(isPlacedShopOrder(order("payment_failed", { paidAt: null }))).toBe(false);
    expect(isPlacedShopOrder(order("cancelled", { paidAt: null }))).toBe(false);
  });

  it("keeps an order cancelled after payment", () => {
    expect(isPlacedShopOrder(order("cancelled"))).toBe(true);
  });
});

describe("buildShopOrderListVm", () => {
  it("is empty when every order is an abandoned checkout", () => {
    expect(
      buildShopOrderListVm([
        order("expired", { paidAt: null }),
        order("cancelled", { paidAt: null }),
      ]),
    ).toEqual({ kind: "empty" });
  });

  it("lists placed orders newest first with a readable title, date, total and status", () => {
    const older = order("paid", { createdAt: "2026-09-01T10:00:00.000Z" });
    const newer = order("pending_payment", { createdAt: "2026-10-20T09:00:00.000Z" });
    const vm = buildShopOrderListVm([older, order("expired", { paidAt: null }), newer]);
    if (vm.kind !== "orders") throw new Error("expected orders");
    expect(vm.rows.map((row) => row.orderId)).toEqual([newer.orderId, older.orderId]);
    const [first] = vm.rows;
    expect(first?.title).toBe("Harbor Print");
    expect(first?.placedLabel).toBe("20 Oct 2026");
    expect(first?.totalLabel).toBe("£100.00");
    expect(first?.status.label).toBe("Pending payment");
    expect(first?.thumbnailUrl).toBe("https://cdn.example/harbor.webp");
    expect(first?.href).toBe(`/account/orders/${newer.orderId}`);
  });

  it("summarises multi-item orders and shows refunds", () => {
    const base = order("partially_refunded", { refundedPence: 4000 });
    const [line] = base.lines;
    if (!line) throw new Error("fixture");
    const vm = buildShopOrderListVm([
      { ...base, lines: [line, { ...line, orderLineId: "x", artworkTitle: "Reed Study" }] },
    ]);
    if (vm.kind !== "orders") throw new Error("expected orders");
    expect(vm.rows[0]?.title).toBe("Harbor Print and 1 more");
    expect(vm.rows[0]?.refundLabel).toBe("£40.00 refunded");
  });

  it("tolerates order lines from an API without images", () => {
    const base = order("paid");
    const lines = base.lines.map(({ imageUrl: _drop, ...line }) => line);
    const vm = buildShopOrderListVm([{ ...base, lines }]);
    if (vm.kind !== "orders") throw new Error("expected orders");
    expect(vm.rows[0]?.thumbnailUrl).toBeNull();
  });
});

describe("buildShopOrderDetailVm", () => {
  it("titles the order by date rather than by its id", () => {
    const vm = buildShopOrderDetailVm(order("paid"));
    expect(vm.title).toBe("Order from 14 Oct 2026");
    expect(vm.totals.at(-1)).toEqual({ label: "Total", value: "£100.00", emphasis: true });
  });

  it("shows an edition number only once the order is paid", () => {
    expect(buildShopOrderDetailVm(order("paid")).lines[0]?.detail).toBe("Edition 7");
    expect(
      buildShopOrderDetailVm(order("cancelled", { paidAt: null })).lines[0]?.detail,
    ).toBeNull();
    expect(buildShopOrderDetailVm(order("pending_payment")).lines[0]?.detail).toBeNull();
  });

  it("explains a cancellation after payment", () => {
    expect(buildShopOrderDetailVm(order("cancelled")).status.hint).toMatch(/after payment/);
  });
});
