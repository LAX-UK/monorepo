// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestOrderRefund = vi.fn();
const refresh = vi.fn();

vi.mock("@/server/application/admin-operations-actions.server", () => ({ requestOrderRefund }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  usePathname: () => "/orders/o-1",
}));
vi.mock("@auction/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@auction/ui")>()),
  toast: { success: vi.fn() },
}));

const { RefundOrderForm } = await import("./refund-form.client");

const ORDER_ID = "7a1d3c52-0000-4000-8000-000000000001";

function openConfirmation() {
  render(<RefundOrderForm orderId={ORDER_ID} orderLineOptions={[]} />);
  fireEvent.change(screen.getByLabelText("Amount (pence)"), { target: { value: "120000" } });
  fireEvent.click(screen.getByRole("button", { name: "Request refund" }));
}

describe("RefundOrderForm confirmation", () => {
  beforeEach(() => {
    requestOrderRefund.mockReset();
    requestOrderRefund.mockResolvedValue({ ok: true, data: { id: "refund-1" } });
  });

  it("shows the amount and consequence before anything is sent", async () => {
    openConfirmation();
    const dialog = await screen.findByRole("dialog", { name: "Refund order 7a1d3c52" });
    expect(dialog).toHaveTextContent("£1,200.00");
    expect(dialog).toHaveTextContent("cannot be undone");
    expect(requestOrderRefund).not.toHaveBeenCalled();
  });

  it("sends nothing when the dialog is cancelled", async () => {
    openConfirmation();
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(requestOrderRefund).not.toHaveBeenCalled();
  });

  it("sends the refund once when confirmed", async () => {
    openConfirmation();
    fireEvent.click(await screen.findByRole("button", { name: "Refund £1,200.00" }));
    await waitFor(() => expect(requestOrderRefund).toHaveBeenCalledTimes(1));
    expect(requestOrderRefund).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: ORDER_ID, amountPence: 120000 }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it("asks for an amount instead of opening the dialog when the field is empty", () => {
    render(<RefundOrderForm orderId={ORDER_ID} orderLineOptions={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Request refund" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(screen.getByLabelText("Amount (pence)")).toHaveAttribute("aria-invalid", "true");
  });
});
