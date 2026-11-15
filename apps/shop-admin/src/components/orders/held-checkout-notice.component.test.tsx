// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const retryCheckoutCleanup = vi.fn();
const refresh = vi.fn();

vi.mock("@/server/application/admin-operations-actions.server", () => ({ retryCheckoutCleanup }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh }),
  usePathname: () => "/orders/o-1",
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));

const { HeldCheckoutNotice } = await import("./held-checkout-notice.client");

const ORDER_ID = "11111111-1111-4111-8111-111111111111";

describe("HeldCheckoutNotice", () => {
  beforeEach(() => {
    retryCheckoutCleanup.mockResolvedValue({
      ok: true,
      data: { id: ORDER_ID, status: "pending_payment" },
    });
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("says the order was taken out of the clean-up and why its prints are still reserved", () => {
    render(<HeldCheckoutNotice orderId={ORDER_ID} />);
    expect(
      screen.getByText("This order was taken out of the checkout clean-up"),
    ).toBeInTheDocument();
    expect(screen.getByText(/its prints are still reserved/)).toBeInTheDocument();
  });

  it("puts the order back in the clean-up with one click, then refreshes the page", async () => {
    render(<HeldCheckoutNotice orderId={ORDER_ID} />);
    fireEvent.click(screen.getByRole("button", { name: "Retry clean-up" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(retryCheckoutCleanup).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: ORDER_ID, idempotencyKey: expect.any(String) }),
    );
  });

  it("shows the reason when it cannot be put back", async () => {
    retryCheckoutCleanup.mockResolvedValue({
      ok: false,
      kind: "failed",
      message: "This order is not held out of the checkout clean-up",
    });
    render(<HeldCheckoutNotice orderId={ORDER_ID} />);
    fireEvent.click(screen.getByRole("button", { name: "Retry clean-up" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This order is not held out of the checkout clean-up",
    );
  });
});
