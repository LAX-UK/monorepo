import type { ReturnRowView } from "@/server/domain/order-returns.vm";
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const markReturnInTransit = vi.fn();
const receiveReturn = vi.fn();
const settleRefundOutsideLax = vi.fn();
const refresh = vi.fn();

vi.mock("@/server/application/admin-operations-actions.server", () => ({
  markReturnInTransit,
  receiveReturn,
  settleRefundOutsideLax,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh }),
  usePathname: () => "/orders/o-1",
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const { ReturnsPanel } = await import("./returns-panel.client");
const { RefundedOutsideDialog, validateRefundedOutside } = await import(
  "./refund-outside-dialog.client"
);

const row = (overrides: Partial<ReturnRowView> = {}): ReturnRowView => ({
  returnId: "11111111-1111-4111-8111-111111111111",
  item: "Marylebone at dusk, edition 12",
  status: "requested",
  statusLabel: { label: "Return requested", tone: "warning" },
  step: 0,
  action: "mark_in_transit",
  outcome: null,
  context: "Requested 20 Oct 2026",
  ...overrides,
});

describe("ReturnsPanel", () => {
  beforeEach(() => {
    markReturnInTransit.mockResolvedValue({ ok: true, data: { id: "x", status: "in_transit" } });
    receiveReturn.mockResolvedValue({ ok: true, data: { id: "x", status: "received" } });
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows nothing when there are no returns", () => {
    const { container } = render(<ReturnsPanel rows={[]} canWrite />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the item, its progress and the next move for a requested return", () => {
    render(<ReturnsPanel rows={[row()]} canWrite />);
    expect(screen.getByRole("heading", { name: "Returns" })).toBeInTheDocument();
    expect(screen.getByText("Marylebone at dusk, edition 12")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /progress of the return/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mark in transit/i })).toBeEnabled();
  });

  it("marks a return in transit", async () => {
    render(<ReturnsPanel rows={[row()]} canWrite />);
    fireEvent.click(screen.getByRole("button", { name: /mark in transit/i }));
    await waitFor(() =>
      expect(markReturnInTransit).toHaveBeenCalledWith(
        expect.objectContaining({ returnId: "11111111-1111-4111-8111-111111111111" }),
      ),
    );
  });

  it("hides the moves from someone who may not make them", () => {
    render(<ReturnsPanel rows={[row()]} canWrite={false} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("receives a print as back on sale unless told otherwise", async () => {
    render(
      <ReturnsPanel rows={[row({ status: "in_transit", step: 1, action: "receive" })]} canWrite />,
    );
    fireEvent.click(screen.getByRole("button", { name: /mark received/i }));
    const confirm = await screen.findByRole("button", { name: "Receive and put back on sale" });
    expect(screen.getByRole("radio", { name: /back on sale/i })).toBeChecked();
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(receiveReturn).toHaveBeenCalledWith(
        expect.objectContaining({ disposition: "back_on_sale" }),
      ),
    );
  });

  it("withdraws a damaged print, and the button says so", async () => {
    render(
      <ReturnsPanel rows={[row({ status: "in_transit", step: 1, action: "receive" })]} canWrite />,
    );
    fireEvent.click(screen.getByRole("button", { name: /mark received/i }));
    fireEvent.click(await screen.findByRole("radio", { name: /withdraw \(damaged\)/i }));
    const confirm = await screen.findByRole("button", { name: "Receive and withdraw" });
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(receiveReturn).toHaveBeenCalledWith(
        expect.objectContaining({ disposition: "withdrawn_damaged" }),
      ),
    );
  });

  it("shows the outcome of a received return and no further move", () => {
    render(
      <ReturnsPanel
        rows={[
          row({
            status: "received",
            step: 2,
            action: null,
            outcome: { label: "Withdrawn, damaged", tone: "neutral" },
          }),
        ]}
        canWrite
      />,
    );
    expect(screen.getByText("Withdrawn, damaged")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("validateRefundedOutside", () => {
  it("needs both a reference and a reason", () => {
    expect(validateRefundedOutside({ reference: "", reason: "" })).toEqual({
      reference: "Enter the reference of the refund, such as the Stripe refund ID.",
      reason: "Say why the customer was refunded outside LAX.",
    });
    expect(validateRefundedOutside({ reference: "  ", reason: "ok" }).reference).toBeDefined();
    expect(validateRefundedOutside({ reference: "re_1", reason: "ok" })).toEqual({});
  });
});

describe("RefundedOutsideDialog", () => {
  beforeEach(() => {
    settleRefundOutsideLax.mockResolvedValue({ ok: true, data: { id: "x", status: "succeeded" } });
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const open = () =>
    render(
      <RefundedOutsideDialog
        refundId="22222222-2222-4222-8222-222222222222"
        amountPence={6000}
        itemLabel="Marylebone at dusk, edition 12"
        failureReason="charge_already_refunded"
        open
        onOpenChange={() => {}}
      />,
    );

  it("names the amount on its button and warns it cannot be undone", async () => {
    open();
    expect(
      await screen.findByRole("button", { name: "Mark £60.00 as refunded" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
    expect(screen.getByText("charge_already_refunded")).toBeInTheDocument();
  });

  it("sends nothing and shows both errors when the fields are empty", async () => {
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Mark £60.00 as refunded" }));
    expect(
      (
        await screen.findAllByText(
          "Enter the reference of the refund, such as the Stripe refund ID.",
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Say why the customer was refunded outside LAX.").length,
    ).toBeGreaterThan(0);
    expect(settleRefundOutsideLax).not.toHaveBeenCalled();
  });

  it("sends the trimmed reference and reason", async () => {
    open();
    fireEvent.change(await screen.findByLabelText(/refund reference/i), {
      target: { value: "  re_3Qdashboard " },
    });
    fireEvent.change(screen.getByLabelText(/^reason/i), {
      target: { value: " Refunded in the dashboard " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Mark £60.00 as refunded" }));
    await waitFor(() =>
      expect(settleRefundOutsideLax).toHaveBeenCalledWith(
        expect.objectContaining({
          refundId: "22222222-2222-4222-8222-222222222222",
          externalReference: "re_3Qdashboard",
          reason: "Refunded in the dashboard",
        }),
      ),
    );
  });

  it("keeps the dialog open and shows why when the API refuses", async () => {
    settleRefundOutsideLax.mockResolvedValue({
      ok: false,
      kind: "failed",
      message: "This refund is still being sent.",
    });
    open();
    fireEvent.change(await screen.findByLabelText(/refund reference/i), {
      target: { value: "re_1" },
    });
    fireEvent.change(screen.getByLabelText(/^reason/i), { target: { value: "Dashboard" } });
    fireEvent.click(screen.getByRole("button", { name: "Mark £60.00 as refunded" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
