import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type LotActionAccess, type LotActionTarget, useLotActions } from "./use-lot-actions";

const refresh = vi.fn();
const publishAction = vi.fn();
const cancelAction = vi.fn();
const deleteAction = vi.fn();
const approveAction = vi.fn();
const declineAction = vi.fn();
const returnAction = vi.fn();
const notifySuccess = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/actions/admin", () => ({
  adminPublishLotResultAction: (...args: unknown[]) => publishAction(...args),
  adminCancelLotResultAction: (...args: unknown[]) => cancelAction(...args),
  adminSoftDeleteLotResultAction: (...args: unknown[]) => deleteAction(...args),
  adminApproveWithdrawalRequestResultAction: (...args: unknown[]) => approveAction(...args),
  adminDeclineWithdrawalRequestResultAction: (...args: unknown[]) => declineAction(...args),
  adminReturnLotToInventoryResultAction: (...args: unknown[]) => returnAction(...args),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: (title: string) => notifySuccess(title), error: vi.fn() },
}));
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  redirectToHostedReauth: vi.fn(),
}));

const FULL: LotActionAccess = {
  canManageCatalog: true,
  canManageAuction: true,
  canDecideWithdrawals: true,
};

const lot: LotActionTarget = {
  id: "lot_1",
  title: "Blue Interior",
  status: "scheduled",
  inDraftSale: false,
  canDelete: false,
  hasWinner: false,
  withdrawalRequested: false,
};

function Harness({ target, access = FULL }: { target: LotActionTarget; access?: LotActionAccess }) {
  const actions = useLotActions(access);
  return (
    <>
      <ul>
        {actions.actionsFor(target).map((action) => (
          <li key={action.id}>
            <button
              type="button"
              disabled={Boolean(action.disabledReason)}
              title={action.disabledReason}
              onClick={() => action.onSelect?.()}
            >
              {action.label}
            </button>
          </li>
        ))}
      </ul>
      {actions.dialogs}
    </>
  );
}

describe("useLotActions", () => {
  beforeEach(() => {
    for (const fn of [
      refresh,
      publishAction,
      cancelAction,
      deleteAction,
      approveAction,
      declineAction,
      returnAction,
      notifySuccess,
    ]) {
      fn.mockReset();
    }
  });

  it("offers a read-only role nothing", () => {
    render(
      <Harness
        target={{ ...lot, status: "draft", canDelete: true }}
        access={{ canManageCatalog: false, canManageAuction: false, canDecideWithdrawals: false }}
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("explains why a lot in a draft sale cannot be published on its own", () => {
    render(<Harness target={{ ...lot, status: "draft", inDraftSale: true }} />);
    const publish = screen.getByRole("button", { name: "Publish lot" });
    expect(publish).toBeDisabled();
    expect(publish).toHaveAttribute("title", "Lots in a draft sale are published with the sale");
  });

  it("asks for a reason before withdrawing, and sends it", async () => {
    cancelAction.mockResolvedValue({ ok: true });
    render(<Harness target={lot} />);
    fireEvent.click(screen.getByRole("button", { name: "Withdraw lot…" }));
    expect(screen.getByRole("heading", { name: "Withdraw Blue Interior?" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Withdraw lot" }));
    expect(cancelAction).not.toHaveBeenCalled();
    expect(screen.getByText("Enter reason for withdrawing.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Reason for withdrawing"), {
      target: { value: "Consignor disputes the attribution" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Withdraw lot" }));
    await waitFor(() =>
      expect(cancelAction).toHaveBeenCalledWith("lot_1", {
        reason: "Consignor disputes the attribution",
      }),
    );
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith("Blue Interior withdrawn"));
    expect(refresh).toHaveBeenCalled();
  });

  it("keeps a failure in the dialog instead of a toast", async () => {
    cancelAction.mockResolvedValue({ ok: false, error: "The lot has already ended." });
    render(<Harness target={lot} />);
    fireEvent.click(screen.getByRole("button", { name: "Withdraw lot…" }));
    fireEvent.change(screen.getByLabelText("Reason for withdrawing"), {
      target: { value: "Damaged in storage" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Withdraw lot" }));
    expect(await screen.findByText("The lot has already ended.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Withdraw Blue Interior?" })).toBeInTheDocument();
    expect(notifySuccess).not.toHaveBeenCalled();
  });

  it("needs the delete phrase typed before deleting", async () => {
    deleteAction.mockResolvedValue({ ok: true });
    render(<Harness target={{ ...lot, status: "draft", canDelete: true }} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete lot…" }));
    const confirm = screen.getByRole("button", { name: "Delete lot" });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: /to confirm/ }), {
      target: { value: "DELETE Blue Interior" },
    });
    fireEvent.click(confirm);
    await waitFor(() => expect(deleteAction).toHaveBeenCalledWith("lot_1", "DELETE Blue Interior"));
  });

  it("decides a seller's withdrawal request, with a reason when declining", async () => {
    declineAction.mockResolvedValue({ ok: true });
    render(<Harness target={{ ...lot, withdrawalRequested: true }} />);
    expect(screen.getByRole("button", { name: "Approve withdrawal request" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Decline withdrawal request" }));
    fireEvent.change(screen.getByLabelText("Reason for the seller"), {
      target: { value: "The sale has opened; the lot stays in it." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Decline and tell the seller" }));
    await waitFor(() =>
      expect(declineAction).toHaveBeenCalledWith(
        "lot_1",
        "The sale has opened; the lot stays in it.",
      ),
    );
  });

  it("keeps a sold lot with its buyer", () => {
    render(<Harness target={{ ...lot, status: "ended", hasWinner: true }} />);
    expect(screen.getByRole("button", { name: "Return to inventory…" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Withdraw lot…" })).not.toBeInTheDocument();
  });
});
