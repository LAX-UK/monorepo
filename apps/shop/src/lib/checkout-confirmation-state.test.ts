import { resolveCheckoutConfirmationView } from "@/lib/checkout-confirmation-state";
import type { OrderSummary } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";

const paidOrder: OrderSummary = {
  orderId: "550e8400-e29b-41d4-a716-446655440001",
  status: "paid",
  fulfilment: "uk_insured_delivery",
  merchandiseSubtotalPence: 12_000,
  fulfilmentSurchargePence: 0,
  totalPence: 12_000,
  createdAt: "2026-01-01T00:00:00.000Z",
  paidAt: "2026-01-01T00:01:00.000Z",
  deliveryAddress: null,
  lines: [],
};

describe("resolveCheckoutConfirmationView", () => {
  it("handles missing order id", () => {
    expect(
      resolveCheckoutConfirmationView({ orderId: undefined, orderResult: { status: "empty" } }),
    ).toEqual({ kind: "missing_order_id" });
  });

  it("maps unauthorized and failed reads", () => {
    expect(
      resolveCheckoutConfirmationView({
        orderId: "ord-1",
        orderResult: { status: "unauthorized" },
      }),
    ).toEqual({ kind: "unauthorized" });
    expect(
      resolveCheckoutConfirmationView({
        orderId: "ord-1",
        orderResult: { status: "failed" },
      }),
    ).toEqual({ kind: "load_failed" });
  });

  it("maps empty order fetch to not found", () => {
    expect(
      resolveCheckoutConfirmationView({
        orderId: "ord-1",
        orderResult: { status: "empty" },
      }),
    ).toEqual({ kind: "not_found" });
  });

  it("maps paid, pending, cancelled, and expired orders", () => {
    expect(
      resolveCheckoutConfirmationView({
        orderId: "ord-1",
        orderResult: { status: "ok", data: paidOrder },
      }),
    ).toMatchObject({ kind: "order", heading: "Thank you" });

    expect(
      resolveCheckoutConfirmationView({
        orderId: "ord-1",
        orderResult: {
          status: "ok",
          data: { ...paidOrder, status: "pending_payment" },
        },
      }),
    ).toMatchObject({ kind: "order", heading: "Payment processing" });

    expect(
      resolveCheckoutConfirmationView({
        orderId: "ord-1",
        orderResult: {
          status: "ok",
          data: { ...paidOrder, status: "cancelled" },
        },
      }),
    ).toMatchObject({ kind: "order", heading: "Order cancelled" });

    expect(
      resolveCheckoutConfirmationView({
        orderId: "ord-1",
        orderResult: {
          status: "ok",
          data: { ...paidOrder, status: "expired" },
        },
      }),
    ).toMatchObject({ kind: "order", heading: "Checkout expired" });

    expect(
      resolveCheckoutConfirmationView({
        orderId: "ord-1",
        orderResult: {
          status: "ok",
          data: { ...paidOrder, status: "payment_failed" },
        },
      }),
    ).toMatchObject({ kind: "order", heading: "Payment could not be completed" });
  });
});
