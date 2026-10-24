import type { PaymentsStaffRow } from "@/lib/admin/finance/payments-staff-list.vm";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePaymentMoneyActions } from "./payment-money-actions";

const refresh = vi.fn();
const refundAction = vi.fn();
const captureAction = vi.fn();
const notifySuccess = vi.fn();

// Radix's dialog portals, traps focus and animates, which is slow and noisy in jsdom. This
// stand-in keeps the open/close contract so the tests cover what the dialogs ask and do.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/actions/admin", () => ({
  adminRefundPaymentResultAction: (...args: unknown[]) => refundAction(...args),
  adminCapturePaymentResultAction: (...args: unknown[]) => captureAction(...args),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: (title: string) => notifySuccess(title), error: vi.fn() },
}));
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  redirectToHostedReauth: vi.fn(),
}));

const REASON = "Buyer withdrew within the cooling-off period";

const payment: PaymentsStaffRow = {
  id: "pay_1",
  lotId: "lot_1",
  lotTitle: "Golden Hour",
  buyerId: "user_1",
  buyer: "Ada Lovelace",
  sellerId: "seller_1",
  amount: "£4,140.00",
  amountPence: 414_000,
  platformFee: "£414.00",
  status: "captured",
  statusPresentation: { label: "Captured", tone: "success" },
  fulfilment: null,
  createdAt: "2026-10-20T10:00:00.000Z",
  xero: { invoiceNumber: null, invoiceUrl: null, syncStatus: null, lastError: null },
  canCapture: false,
  canRefund: true,
};

function Harness({ row, canWrite = true }: { row: PaymentsStaffRow; canWrite?: boolean }) {
  const money = usePaymentMoneyActions({ canWritePayments: canWrite });
  const actions = money.actionsFor(row);
  return (
    <>
      <ul>
        {actions.map((action) => (
          <li key={action.id}>
            <button
              type="button"
              disabled={Boolean(action.disabledReason)}
              onClick={() => action.onSelect?.()}
            >
              {action.label}
            </button>
          </li>
        ))}
      </ul>
      {money.dialogs}
    </>
  );
}

describe("usePaymentMoneyActions", () => {
  beforeEach(() => {
    for (const fn of [refresh, refundAction, captureAction, notifySuccess]) fn.mockReset();
  });

  it("offers nothing to a role that cannot move money", () => {
    render(<Harness row={payment} canWrite={false} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("confirms a refund with the amount, the buyer and a required reason", async () => {
    refundAction.mockResolvedValue({ ok: true });
    render(<Harness row={payment} />);
    fireEvent.click(screen.getByRole("button", { name: "Refund £4,140.00" }));

    expect(
      screen.getByRole("heading", { name: "Refund £4,140.00 to Ada Lovelace?" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Golden Hour")).toBeInTheDocument();
    const confirm = screen.getAllByRole("button", { name: "Refund £4,140.00" }).at(-1);
    fireEvent.click(confirm as HTMLElement);
    expect(refundAction).not.toHaveBeenCalled();
    expect(screen.getByText(/at least 10 characters/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Reason for the refund"), {
      target: { value: REASON },
    });
    fireEvent.click(confirm as HTMLElement);
    await waitFor(() => expect(refundAction).toHaveBeenCalledWith("pay_1", { reason: REASON }));
    await waitFor(() =>
      expect(notifySuccess).toHaveBeenCalledWith("Refunded £4,140.00 to Ada Lovelace"),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("keeps the dialog open with the reason when the refund fails", async () => {
    refundAction.mockResolvedValue({ ok: false, error: "Stripe declined the refund." });
    render(<Harness row={payment} />);
    fireEvent.click(screen.getByRole("button", { name: "Refund £4,140.00" }));
    fireEvent.change(screen.getByLabelText("Reason for the refund"), {
      target: { value: REASON },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Refund £4,140.00" }).at(-1) as HTMLElement,
    );
    expect(await screen.findByText("Stripe declined the refund.")).toBeInTheDocument();
    expect(screen.getByLabelText("Reason for the refund")).toHaveValue(REASON);
  });

  it("asks for a fresh sign-in when the API requires one", async () => {
    refundAction.mockResolvedValue({
      ok: false,
      error: "Recent sign-in required",
      errorCode: "step_up_required",
    });
    render(<Harness row={payment} />);
    fireEvent.click(screen.getByRole("button", { name: "Refund £4,140.00" }));
    fireEvent.change(screen.getByLabelText("Reason for the refund"), {
      target: { value: REASON },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Refund £4,140.00" }).at(-1) as HTMLElement,
    );
    expect(await screen.findByRole("heading", { name: "Confirm it’s you" })).toBeInTheDocument();
  });

  it("offers capture only while the money is held, and refund once it is captured", () => {
    render(
      <Harness row={{ ...payment, status: "authorized", canCapture: true, canRefund: false }} />,
    );
    expect(screen.getByRole("button", { name: "Capture £4,140.00" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Refund £4,140.00" })).toBeDisabled();
  });
});
