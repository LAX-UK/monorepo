import type { ManualReviewStaffRow } from "@/lib/admin/finance/payments-staff-list.vm";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useManualReviewActions } from "./manual-review-actions";

const refresh = vi.fn();
const refundAction = vi.fn();
const releaseAction = vi.fn();
const notifySuccess = vi.fn();

vi.mock("@auction/ui/components/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <dialog open>{children}</dialog> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/actions/admin/admin-manual-review", () => ({
  refundManualReviewPaymentResultAction: (...args: unknown[]) => refundAction(...args),
  releaseManualReviewPaymentResultAction: (...args: unknown[]) => releaseAction(...args),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: (title: string) => notifySuccess(title), error: vi.fn() },
}));
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  redirectToHostedReauth: vi.fn(),
}));

const REASON = "Buyer withdrew within the cooling-off period";

const held: ManualReviewStaffRow = {
  id: "pay_1",
  lotId: "lot_1",
  lotTitle: "Golden Hour",
  lotNumber: 12,
  winnerId: "user_1",
  winner: "ada@example.test",
  seller: "Gallery One",
  amount: "£4,140.00",
  reason: "High value",
  compliance: false,
  source: {} as ManualReviewStaffRow["source"],
};

function Harness({ row, canResolve = true }: { row: ManualReviewStaffRow; canResolve?: boolean }) {
  const money = useManualReviewActions({ canResolve });
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

describe("useManualReviewActions", () => {
  beforeEach(() => {
    for (const fn of [refresh, refundAction, releaseAction, notifySuccess]) fn.mockReset();
  });

  it("offers nothing to a role that cannot resolve holds", () => {
    render(<Harness row={held} canResolve={false} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("refunds only with a reason, naming the amount and the winner", async () => {
    refundAction.mockResolvedValue({ ok: true });
    render(<Harness row={held} />);
    fireEvent.click(screen.getByRole("button", { name: "Refund £4,140.00" }));
    expect(
      screen.getByRole("heading", { name: "Refund £4,140.00 to ada@example.test?" }),
    ).toBeInTheDocument();
    const confirm = screen.getAllByRole("button", { name: "Refund £4,140.00" }).at(-1);
    fireEvent.click(confirm as HTMLElement);
    expect(refundAction).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Reason for the refund"), {
      target: { value: REASON },
    });
    fireEvent.click(confirm as HTMLElement);
    await waitFor(() =>
      expect(refundAction).toHaveBeenCalledWith(
        "pay_1",
        expect.objectContaining({ reason: REASON }),
      ),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("releases a finance hold through its own confirm", async () => {
    releaseAction.mockResolvedValue({ ok: true });
    render(<Harness row={held} />);
    fireEvent.click(screen.getByRole("button", { name: "Release for checkout" }));
    expect(
      screen.getByRole("heading", { name: "Release £4,140.00 for checkout?" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Release for checkout" }).at(-1) as HTMLElement,
    );
    await waitFor(() => expect(releaseAction).toHaveBeenCalled());
  });

  it("never releases a compliance hold", () => {
    render(<Harness row={{ ...held, compliance: true, reason: "AML hold" }} />);
    expect(screen.getByRole("button", { name: "Release for checkout" })).toBeDisabled();
  });

  it("asks for a fresh sign-in when the API requires one", async () => {
    refundAction.mockResolvedValue({
      ok: false,
      error: "Recent sign-in required",
      errorCode: "step_up_required",
    });
    render(<Harness row={held} />);
    fireEvent.click(screen.getByRole("button", { name: "Refund £4,140.00" }));
    fireEvent.change(screen.getByLabelText("Reason for the refund"), {
      target: { value: REASON },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Refund £4,140.00" }).at(-1) as HTMLElement,
    );
    expect(await screen.findByRole("heading", { name: "Confirm it’s you" })).toBeInTheDocument();
  });
});
