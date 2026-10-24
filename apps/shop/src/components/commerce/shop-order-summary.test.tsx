/** @vitest-environment jsdom */
import type { OrderSummary } from "@auction/shop-contracts";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ShopOrderSummary } from "./shop-order-summary";

const order: OrderSummary = {
  orderId: "550e8400-e29b-41d4-a716-846655440001",
  status: "partially_refunded",
  fulfilment: "uk_insured_delivery",
  merchandiseSubtotalPence: 12000,
  fulfilmentSurchargePence: 0,
  totalPence: 12000,
  refundedPence: 4000,
  lines: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  paidAt: "2026-01-01T00:01:00.000Z",
  deliveryAddress: null,
};

describe("ShopOrderSummary", () => {
  afterEach(cleanup);

  it("shows a partly refunded order with the amount returned", () => {
    render(<ShopOrderSummary order={order} />);
    expect(screen.getByText("Partly refunded")).toBeTruthy();
    expect(screen.getByText("Refunded")).toBeTruthy();
    expect(screen.getByText("£40.00")).toBeTruthy();
  });

  it("shows a fully refunded order", () => {
    render(<ShopOrderSummary order={{ ...order, status: "refunded", refundedPence: 12000 }} />);
    expect(screen.getAllByText("Refunded").length).toBeGreaterThan(0);
    expect(screen.getAllByText("£120.00")).toHaveLength(3);
  });

  it("omits the refunded row when nothing was refunded", () => {
    render(<ShopOrderSummary order={{ ...order, status: "paid", refundedPence: 0 }} />);
    expect(screen.queryByText("Refunded")).toBeNull();
  });
});
