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
const buyerDefaultAction = vi.fn();
const returnToLaxArtAction = vi.fn();
const previewAction = vi.fn();
const startAction = vi.fn();
const notifyError = vi.fn();
const notifySuccess = vi.fn();
const notifySuccessDescription = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/actions/admin", () => ({
  adminPublishLotResultAction: (...args: unknown[]) => publishAction(...args),
  adminCancelLotResultAction: (...args: unknown[]) => cancelAction(...args),
  adminSoftDeleteLotResultAction: (...args: unknown[]) => deleteAction(...args),
  adminApproveWithdrawalRequestResultAction: (...args: unknown[]) => approveAction(...args),
  adminDeclineWithdrawalRequestResultAction: (...args: unknown[]) => declineAction(...args),
  adminReturnLotToInventoryResultAction: (...args: unknown[]) => returnAction(...args),
  adminReturnLotToLaxArtResultAction: (...args: unknown[]) => returnToLaxArtAction(...args),
  adminRecordBuyerDefaultResultAction: (...args: unknown[]) => buyerDefaultAction(...args),
}));
vi.mock("@/lib/actions/admin/admin-reoffers", () => ({
  adminLoadReofferPreviewAction: (...args: unknown[]) => previewAction(...args),
  adminStartReofferResultAction: (...args: unknown[]) => startAction(...args),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: {
    success: (title: string, options?: { description?: string }) => {
      notifySuccess(title);
      if (options?.description) notifySuccessDescription(options.description);
    },
    error: (title: string, options?: { description?: string }) =>
      notifyError(title, options?.description),
  },
}));
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  redirectToHostedReauth: vi.fn(),
}));

const NEXT_BIDDER = {
  soldOnAtg: false,
  next: {
    userId: "u2",
    legalEntityId: "e2",
    accountName: "Northbank Gallery",
    bidMinor: 8_200_000,
    placedAt: "2026-10-23T18:11:00.000Z",
    belowReserve: false,
    othersAfter: 2,
  },
  noneReason: null,
  skippedBidders: [],
  offersMade: 0,
};

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

/** Two lots on one page, so the one Buyer default dialog can be opened for each in turn. */
function TwoLots({ a, b }: { a: LotActionTarget; b: LotActionTarget }) {
  const actions = useLotActions(FULL);
  return (
    <>
      {[a, b].map((target) =>
        actions
          .actionsFor(target)
          .filter((action) => action.label === "Buyer default…")
          .map((action) => (
            <button key={target.id} type="button" onClick={() => action.onSelect?.()}>
              {`${action.label} ${target.title}`}
            </button>
          )),
      )}
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
      returnToLaxArtAction,
      buyerDefaultAction,
      notifySuccess,
      notifyError,
      previewAction,
      startAction,
    ]) {
      fn.mockReset();
    }
    previewAction.mockResolvedValue({ ok: true, data: NEXT_BIDDER });
    startAction.mockResolvedValue({ ok: true, data: { status: "awaiting_seller" } });
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

  it("offers Buyer default only for an ended lot with a winner, to the roles that manage auctions", () => {
    const ended = { ...lot, status: "ended" as const, hasWinner: true };
    const { unmount } = render(<Harness target={ended} />);
    expect(screen.getByRole("button", { name: "Buyer default…" })).toBeEnabled();
    unmount();

    render(<Harness target={{ ...ended, hasWinner: false }} />);
    expect(screen.queryByRole("button", { name: "Buyer default…" })).not.toBeInTheDocument();
  });

  it("hides Buyer default from roles that cannot manage auctions", () => {
    render(
      <Harness
        target={{ ...lot, status: "ended", hasWinner: true }}
        access={{ canManageCatalog: true, canManageAuction: false, canDecideWithdrawals: false }}
      />,
    );
    expect(screen.queryByRole("button", { name: "Buyer default…" })).not.toBeInTheDocument();
  });

  it("needs a reason, defaults to returning the lot, and sends the choices", async () => {
    buyerDefaultAction.mockResolvedValue({ ok: true });
    render(<Harness target={{ ...lot, status: "ended", hasWinner: true }} />);
    fireEvent.click(screen.getByRole("button", { name: "Buyer default…" }));
    expect(
      screen.getByRole("heading", { name: "Record a buyer default for Blue Interior?" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Return to inventory/ })).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Record buyer default" }));
    expect(buyerDefaultAction).not.toHaveBeenCalled();
    expect(screen.getByText("Enter reason.")).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("radio", { name: /Offer to the next bidder/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Pause the buyer's bidding/ }));
    fireEvent.change(screen.getByLabelText("Reason"), {
      target: { value: "No reply after two reminders" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Record buyer default" }));
    await waitFor(() =>
      expect(buyerDefaultAction).toHaveBeenCalledWith("lot_1", {
        outcome: "offered_to_underbidder",
        reason: "No reply after two reminders",
        restrictBidding: true,
      }),
    );
    await waitFor(() => expect(startAction).toHaveBeenCalledWith("lot_1"));
    await waitFor(() =>
      expect(notifySuccess).toHaveBeenCalledWith("Re-offer started: the seller has been asked"),
    );
    expect(refresh).toHaveBeenCalled();
  });

  describe("offering to the next bidder", () => {
    const ended = { ...lot, status: "ended" as const, hasWinner: true };
    const record = async (reason = "No payment") => {
      fireEvent.click(await screen.findByRole("radio", { name: /Offer to the next bidder/ }));
      fireEvent.change(screen.getByLabelText("Reason"), { target: { value: reason } });
      fireEvent.click(screen.getByRole("button", { name: "Record buyer default" }));
    };

    it("names the bidder, their bid and the bidders after them", async () => {
      render(<Harness target={ended} />);
      fireEvent.click(screen.getByRole("button", { name: "Buyer default…" }));
      const line = await screen.findByTestId("next-bidder");
      expect(line).toHaveTextContent("Northbank Gallery · their bid £82,000.00 on");
      expect(line).toHaveTextContent("2 other bidders after them");
      expect(previewAction).toHaveBeenCalledWith("lot_1");
    });

    it("says no one else bid and keeps the option closed", async () => {
      previewAction.mockResolvedValue({
        ok: true,
        data: { ...NEXT_BIDDER, next: null, noneReason: "no_other_bidder" },
      });
      render(<Harness target={ended} />);
      fireEvent.click(screen.getByRole("button", { name: "Buyer default…" }));
      expect(await screen.findByText("No one else bid on this lot.")).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: /Offer to the next bidder/ })).toBeDisabled();
    });

    it("does not offer the option until it knows who is next", () => {
      previewAction.mockReturnValue(new Promise(() => undefined));
      render(<Harness target={ended} />);
      fireEvent.click(screen.getByRole("button", { name: "Buyer default…" }));
      expect(screen.getByText("Checking who bid next…")).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: /Offer to the next bidder/ })).toBeDisabled();
    });

    it("says the default was recorded when the offer could not start, and points to the lot page", async () => {
      buyerDefaultAction.mockResolvedValue({ ok: true });
      startAction.mockResolvedValue({ ok: false, error: "Three offers have been made." });
      render(<Harness target={ended} />);
      fireEvent.click(screen.getByRole("button", { name: "Buyer default…" }));
      await record();
      await waitFor(() =>
        expect(notifyError).toHaveBeenCalledWith(
          "Buyer default recorded, but the offer did not start",
          "Three offers have been made. Start it from the lot page.",
        ),
      );
      expect(refresh).toHaveBeenCalled();
    });

    it("does not start an offer when the default itself is refused", async () => {
      buyerDefaultAction.mockResolvedValue({ ok: false, error: "The buyer has paid." });
      render(<Harness target={ended} />);
      fireEvent.click(screen.getByRole("button", { name: "Buyer default…" }));
      await record();
      expect(await screen.findByText("The buyer has paid.")).toBeInTheDocument();
      expect(startAction).not.toHaveBeenCalled();
    });

    it("never shows one lot's next bidder under another lot", async () => {
      let answerA: (value: unknown) => void = () => undefined;
      previewAction.mockImplementation((lotId: string) =>
        lotId === "lot_a"
          ? new Promise((resolve) => {
              answerA = resolve;
            })
          : Promise.resolve({
              ok: true,
              data: {
                ...NEXT_BIDDER,
                next: { ...NEXT_BIDDER.next, accountName: "Lot B's bidder" },
              },
            }),
      );
      render(
        <TwoLots
          a={{ ...ended, id: "lot_a", title: "Lot A" }}
          b={{ ...ended, id: "lot_b", title: "Lot B" }}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Buyer default… Lot A" }));
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      fireEvent.click(screen.getByRole("button", { name: "Buyer default… Lot B" }));
      expect(await screen.findByTestId("next-bidder")).toHaveTextContent("Lot B's bidder");
      // A's answer arrives late, while B is open: it is dropped.
      answerA({
        ok: true,
        data: { ...NEXT_BIDDER, next: { ...NEXT_BIDDER.next, accountName: "Lot A's bidder" } },
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(screen.getByTestId("next-bidder")).toHaveTextContent("Lot B's bidder");
      expect(screen.queryByText(/Lot A's bidder/)).not.toBeInTheDocument();
    });

    it("asks for a fresh sign-in when starting the offer needs one, and keeps the default", async () => {
      buyerDefaultAction.mockResolvedValue({ ok: true });
      startAction.mockResolvedValue({
        ok: false,
        error: "Confirm it’s you",
        errorCode: "step_up_required",
      });
      render(<Harness target={ended} />);
      fireEvent.click(screen.getByRole("button", { name: "Buyer default…" }));
      await record();
      expect(
        await screen.findByText(
          "To start this offer, sign in again. You will come back to this page to finish.",
        ),
      ).toBeInTheDocument();
      expect(notifyError).not.toHaveBeenCalled();
      expect(notifySuccess).toHaveBeenCalledWith("Buyer default recorded for Blue Interior");
      expect(refresh).toHaveBeenCalled();
    });

    it("no longer promises that no fees are added", async () => {
      render(<Harness target={ended} />);
      fireEvent.click(screen.getByRole("button", { name: "Buyer default…" }));
      expect(screen.queryByText(/no fees or interest/i)).not.toBeInTheDocument();
    });
  });

  it("replaces Buyer default with the ATG settlement note for a lot sold on ATG", () => {
    render(<Harness target={{ ...lot, status: "ended", soldOnAtg: true }} />);
    const action = screen.getByRole("button", { name: "Buyer default…" });
    expect(action).toBeDisabled();
    expect(action).toHaveAttribute("title", "Sold on ATG: follow the ATG settlement runbook");
  });

  describe("return to lax.art", () => {
    const linked = {
      title: "Blue Interior",
      stockCode: "LAX-ORI-PH-GAC-26-0001",
      canReturn: true,
      reasons: [],
    };

    it("is offered only for a lot linked to the artwork register", () => {
      render(<Harness target={{ ...lot, status: "ended" }} />);
      expect(screen.queryByRole("button", { name: "Return to lax.art…" })).not.toBeInTheDocument();
    });

    it("is left out for a role that cannot manage the auction", () => {
      render(
        <Harness
          target={{ ...lot, status: "ended", laxArtReturn: linked }}
          access={{ canManageCatalog: true, canManageAuction: false, canDecideWithdrawals: false }}
        />,
      );
      expect(screen.queryByRole("button", { name: "Return to lax.art…" })).not.toBeInTheDocument();
    });

    it("is disabled with the reason when the lot cannot go back", () => {
      render(
        <Harness
          target={{
            ...lot,
            status: "active",
            laxArtReturn: {
              ...linked,
              canReturn: false,
              reasons: ["This lot is still in a sale."],
            },
          }}
        />,
      );
      const button = screen.getByRole("button", { name: "Return to lax.art…" });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("title", "This lot is still in a sale.");
    });

    it("asks first, then reopens the listing and says so", async () => {
      returnToLaxArtAction.mockResolvedValue({ ok: true, data: { laxArtListing: true } });
      render(<Harness target={{ ...lot, status: "ended", laxArtReturn: linked }} />);
      fireEvent.click(screen.getByRole("button", { name: "Return to lax.art…" }));
      expect(screen.getByText(/nothing goes live until you publish it in LAX Admin/)).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "Return to lax.art" }));
      await waitFor(() => expect(returnToLaxArtAction).toHaveBeenCalledWith("lot_1"));
      await waitFor(() =>
        expect(notifySuccess).toHaveBeenCalledWith("Blue Interior is back on lax.art as a draft"),
      );
    });

    it("does not promise a reopened listing in the confirm text", () => {
      render(<Harness target={{ ...lot, status: "ended", laxArtReturn: linked }} />);
      fireEvent.click(screen.getByRole("button", { name: "Return to lax.art…" }));
      expect(
        screen.getByText(/If it was never listed there, only the LAX register is updated/),
      ).toBeVisible();
    });

    it("says the artwork was never listed, with the hint, when there is no lax.art listing", async () => {
      returnToLaxArtAction.mockResolvedValue({
        ok: true,
        data: { laxArtListing: false, hint: "Create it from the Zoho record in LAX Admin first." },
      });
      render(<Harness target={{ ...lot, status: "ended", laxArtReturn: linked }} />);
      fireEvent.click(screen.getByRole("button", { name: "Return to lax.art…" }));
      fireEvent.click(screen.getByRole("button", { name: "Return to lax.art" }));
      await waitFor(() =>
        expect(notifySuccess).toHaveBeenCalledWith("Blue Interior is back in the LAX register"),
      );
      expect(notifySuccess).not.toHaveBeenCalledWith(expect.stringContaining('draft"'));
      expect(notifySuccessDescription).toHaveBeenCalledWith(
        "Create it from the Zoho record in LAX Admin first.",
      );
    });

    it("keeps a refusal in the dialog so staff can try again", async () => {
      returnToLaxArtAction.mockResolvedValue({
        ok: false,
        error: "The other product could not be reached (network). Try again in a moment.",
      });
      render(<Harness target={{ ...lot, status: "ended", laxArtReturn: linked }} />);
      fireEvent.click(screen.getByRole("button", { name: "Return to lax.art…" }));
      fireEvent.click(screen.getByRole("button", { name: "Return to lax.art" }));
      expect(await screen.findByText(/Try again in a moment/)).toBeInTheDocument();
      expect(notifySuccess).not.toHaveBeenCalled();
    });
  });

  it("keeps a refusal in the dialog with what was typed", async () => {
    buyerDefaultAction.mockResolvedValue({
      ok: false,
      error: "The buyer has paid or is paying. Refund the payment instead of marking a default.",
    });
    render(<Harness target={{ ...lot, status: "ended", hasWinner: true }} />);
    fireEvent.click(screen.getByRole("button", { name: "Buyer default…" }));
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "No payment" } });
    fireEvent.click(screen.getByRole("button", { name: "Record buyer default" }));
    expect(await screen.findByText(/Refund the payment instead/)).toBeInTheDocument();
    expect(screen.getByLabelText("Reason")).toHaveValue("No payment");
    expect(notifySuccess).not.toHaveBeenCalled();
  });
});
