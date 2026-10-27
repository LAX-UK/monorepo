// @vitest-environment jsdom
import type { AdminOrderDetail } from "@auction/shop-contracts";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/orders/1",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/server/application/admin-operations-actions.server", () => ({
  requestOrderRefund: vi.fn(),
}));
vi.mock("@/server/domain/order-detail.vm", () => ({
  REFUND_REASON_OPTIONS: [{ value: "goodwill", label: "Goodwill" }],
  refundTargetOptions: () => [{ id: "", label: "Whole order" }],
  refundableRemainingPence: () => 10000,
}));

const { RefundDialog } = await import("./refund-dialog.client");

const detail = {
  orderId: "11111111-1111-4111-8111-111111111111",
  reference: "LAX-1",
} as AdminOrderDetail;

describe("RefundDialog", () => {
  afterEach(cleanup);

  it("starts with the cursor on the amount", async () => {
    render(<RefundDialog detail={detail} open onOpenChange={() => {}} />);
    const amount = await screen.findByPlaceholderText("0.00");
    await vi.waitFor(() => expect(document.activeElement).toBe(amount));
  });

  it("shows the full-amount button as a button with the amount on it", () => {
    render(<RefundDialog detail={detail} open onOpenChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Use £100.00" })).toBeEnabled();
  });
});
