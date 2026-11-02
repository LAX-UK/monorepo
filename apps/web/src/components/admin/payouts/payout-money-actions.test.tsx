import type { PayoutsStaffRow } from "@/lib/admin/finance/payouts-staff-list.vm";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePayoutMoneyActions } from "./payout-money-actions";

const refresh = vi.fn();
const markPaidAction = vi.fn();
const retryAction = vi.fn();
const adjustAction = vi.fn();
const reverseAction = vi.fn();
const notifySuccess = vi.fn();

// Radix's dialog portals, traps focus and animates, which is slow and noisy in jsdom. This
// stand-in keeps the open/close contract so the tests cover what the dialogs ask and do.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/actions/admin/admin-payouts", () => ({
  adminMarkPayoutPaidResultAction: (...args: unknown[]) => markPaidAction(...args),
  adminRetryPayoutTransferResultAction: (...args: unknown[]) => retryAction(...args),
  adminAddPayoutAdjustmentResultAction: (...args: unknown[]) => adjustAction(...args),
  adminReversePayoutResultAction: (...args: unknown[]) => reverseAction(...args),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: (title: string) => notifySuccess(title), error: vi.fn() },
}));
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  redirectToHostedReauth: vi.fn(),
}));

const REASON = "Seller asked for the fee to be waived";

const payout: PayoutsStaffRow = {
  id: "payout_1",
  legalEntityId: "entity_1",
  seller: "Gallery One",
  period: "1 Oct 2026 – 31 Oct 2026",
  periodStart: "2026-10-01T00:00:00.000Z",
  gross: "£5,000.00",
  platformFee: "£500.00",
  stripeFee: "£0.00",
  net: "£4,500.00",
  netPence: 450_000,
  status: "scheduled",
  statusPresentation: { label: "Scheduled", tone: "info" },
  stripeTransferId: "tr_gallery_one",
  failureReason: null,
  statementError: null,
  paidAt: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  canMarkPaid: true,
  canAdjust: true,
  canReverse: false,
  canRetryTransfer: false,
};

function Harness({
  row,
  canProcess = true,
  canReverse = true,
}: {
  row: PayoutsStaffRow;
  canProcess?: boolean;
  canReverse?: boolean;
}) {
  const money = usePayoutMoneyActions({ canProcess, canReverse });
  return (
    <>
      <ul>
        {money.actionsFor(row).map((action) => (
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

describe("usePayoutMoneyActions", () => {
  beforeEach(() => {
    for (const fn of [
      refresh,
      markPaidAction,
      retryAction,
      adjustAction,
      reverseAction,
      notifySuccess,
    ]) {
      fn.mockReset();
    }
  });

  it("offers nothing to a role that cannot process or reverse payouts", () => {
    render(<Harness row={payout} canProcess={false} canReverse={false} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers each step only when the payout is in a state that allows it", () => {
    render(
      <Harness
        row={{ ...payout, status: "paid", canMarkPaid: false, canAdjust: false, canReverse: true }}
      />,
    );
    expect(screen.getByRole("button", { name: "Mark £4,500.00 paid" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add adjustment" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reverse £4,500.00" })).toBeEnabled();
  });

  it("confirms mark paid with the amount, the seller and the transfer ID", async () => {
    markPaidAction.mockResolvedValue({ ok: true });
    render(<Harness row={payout} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark £4,500.00 paid" }));

    expect(
      screen.getByRole("heading", { name: "Mark £4,500.00 as paid to Gallery One?" }),
    ).toBeInTheDocument();
    const transfer = screen.getByLabelText("Stripe transfer ID");
    expect(transfer).toHaveValue("tr_gallery_one");

    fireEvent.change(transfer, { target: { value: "tr_bank_run" } });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Mark £4,500.00 paid" }).at(-1) as HTMLElement,
    );
    await waitFor(() =>
      expect(markPaidAction).toHaveBeenCalledWith(
        "payout_1",
        expect.objectContaining({ stripeTransferId: "tr_bank_run" }),
      ),
    );
    await waitFor(() =>
      expect(notifySuccess).toHaveBeenCalledWith("Marked £4,500.00 as paid to Gallery One"),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("will not mark a payout paid without a transfer ID", () => {
    render(<Harness row={{ ...payout, stripeTransferId: null }} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark £4,500.00 paid" }));
    fireEvent.click(
      screen.getAllByRole("button", { name: "Mark £4,500.00 paid" }).at(-1) as HTMLElement,
    );
    expect(markPaidAction).not.toHaveBeenCalled();
    expect(screen.getByText("Enter the Stripe transfer ID.")).toBeInTheDocument();
  });

  it("asks for a signed amount and a reason, and names the amount on the button", async () => {
    adjustAction.mockResolvedValue({ ok: true });
    render(<Harness row={payout} />);
    fireEvent.click(screen.getByRole("button", { name: "Add adjustment" }));

    expect(
      screen.getByRole("heading", { name: "Adjust the £4,500.00 payout to Gallery One?" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Adjustment amount"), { target: { value: "-25" } });
    fireEvent.change(screen.getByLabelText("Reason for the adjustment"), {
      target: { value: REASON },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add −£25.00" }));

    await waitFor(() =>
      expect(adjustAction).toHaveBeenCalledWith("payout_1", { amount: "-25.00", note: REASON }),
    );
    await waitFor(() =>
      expect(notifySuccess).toHaveBeenCalledWith("Added −£25.00 to the payout for Gallery One"),
    );
  });

  it("does not send an adjustment whose amount is not a sum of pounds", () => {
    render(<Harness row={payout} />);
    fireEvent.click(screen.getByRole("button", { name: "Add adjustment" }));
    fireEvent.change(screen.getByLabelText("Adjustment amount"), { target: { value: "lots" } });
    fireEvent.change(screen.getByLabelText("Reason for the adjustment"), {
      target: { value: REASON },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Add adjustment" }).at(-1) as HTMLElement,
    );
    expect(adjustAction).not.toHaveBeenCalled();
    expect(screen.getByText(/Enter an amount in pounds/)).toBeInTheDocument();
  });

  it("makes the reversal reason and typed reference mandatory, then sends them", async () => {
    reverseAction.mockResolvedValue({ ok: true });
    render(<Harness row={{ ...payout, status: "paid", canReverse: true }} />);
    fireEvent.click(screen.getByRole("button", { name: "Reverse £4,500.00" }));

    expect(
      screen.getByRole("heading", { name: "Reverse the £4,500.00 payout to Gallery One?" }),
    ).toBeInTheDocument();
    const confirm = screen
      .getAllByRole("button", { name: "Reverse £4,500.00" })
      .at(-1) as HTMLElement;
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Reason for the reversal"), {
      target: { value: REASON },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /to confirm/ }), {
      target: { value: "REVERSE PAYOUT payout_1" },
    });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(reverseAction).toHaveBeenCalledWith(
        "payout_1",
        expect.objectContaining({ reason: REASON }),
      ),
    );
    await waitFor(() =>
      expect(notifySuccess).toHaveBeenCalledWith("Reversed the £4,500.00 payout to Gallery One"),
    );
  });

  it("keeps the dialog open with what was typed when the call fails", async () => {
    reverseAction.mockResolvedValue({ ok: false, error: "The payout is already reversed." });
    render(<Harness row={{ ...payout, status: "paid", canReverse: true }} />);
    fireEvent.click(screen.getByRole("button", { name: "Reverse £4,500.00" }));
    fireEvent.change(screen.getByLabelText("Reason for the reversal"), {
      target: { value: REASON },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /to confirm/ }), {
      target: { value: "REVERSE PAYOUT payout_1" },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Reverse £4,500.00" }).at(-1) as HTMLElement,
    );

    expect(await screen.findByText("The payout is already reversed.")).toBeInTheDocument();
    expect(screen.getByLabelText("Reason for the reversal")).toHaveValue(REASON);
  });

  it("asks for a fresh sign-in when the API requires one", async () => {
    markPaidAction.mockResolvedValue({
      ok: false,
      error: "Recent sign-in required",
      errorCode: "step_up_required",
    });
    render(<Harness row={payout} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark £4,500.00 paid" }));
    fireEvent.click(
      screen.getAllByRole("button", { name: "Mark £4,500.00 paid" }).at(-1) as HTMLElement,
    );
    expect(await screen.findByRole("heading", { name: "Confirm it’s you" })).toBeInTheDocument();
  });

  const failedPayout = {
    ...payout,
    status: "failed" as const,
    canMarkPaid: false,
    canAdjust: false,
    canRetryTransfer: true,
    failureReason: "stripe_transfer_failed: account_closed - Account closed",
  };

  it("offers a retry only for a failed payout, and only to someone who can process", () => {
    const { unmount } = render(<Harness row={payout} />);
    expect(screen.queryByRole("button", { name: "Retry transfer" })).not.toBeInTheDocument();
    unmount();
    const failed = render(<Harness row={failedPayout} canProcess={false} />);
    expect(screen.queryByRole("button", { name: "Retry transfer" })).not.toBeInTheDocument();
    failed.unmount();
    render(<Harness row={failedPayout} />);
    expect(screen.getByRole("button", { name: "Retry transfer" })).toBeEnabled();
  });

  it("confirms a retry with the amount, the seller and why it failed", async () => {
    retryAction.mockResolvedValue({ ok: true });
    render(<Harness row={failedPayout} />);
    fireEvent.click(screen.getByRole("button", { name: "Retry transfer" }));

    expect(
      screen.getByRole("heading", { name: "Retry the £4,500.00 transfer to Gallery One?" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/account_closed/)).toBeInTheDocument();
    expect(retryAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Retry £4,500.00 transfer" }));
    await waitFor(() =>
      expect(retryAction).toHaveBeenCalledWith(
        "payout_1",
        expect.objectContaining({ idempotencyKey: expect.any(String) }),
      ),
    );
    await waitFor(() =>
      expect(notifySuccess).toHaveBeenCalledWith(
        "Sent the £4,500.00 transfer to Gallery One again",
      ),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("keeps the dialog open with the reason when the retry is refused", async () => {
    retryAction.mockResolvedValue({
      ok: false,
      error: "The seller's Stripe account cannot receive transfers yet.",
    });
    render(<Harness row={failedPayout} />);
    fireEvent.click(screen.getByRole("button", { name: "Retry transfer" }));
    fireEvent.click(screen.getByRole("button", { name: "Retry £4,500.00 transfer" }));

    expect(
      await screen.findByText("The seller's Stripe account cannot receive transfers yet."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry £4,500.00 transfer" })).toBeInTheDocument();
  });
});
