import type { LotReofferBundle } from "@/lib/admin/reoffer/reoffer-bundle";
import { BUYER_DEFAULT, NO_PREVIEW, PREVIEW, offer } from "@/lib/admin/reoffer/reoffer-fixtures";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReofferCardSection } from "./reoffer-card-section";

const refresh = vi.fn();
const start = vi.fn();
const answer = vi.fn();
const send = vi.fn();
const withdraw = vi.fn();
const returnToInventory = vi.fn();
const notifySuccess = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/actions/admin/admin-reoffers", () => ({
  adminStartReofferResultAction: (...a: unknown[]) => start(...a),
  adminRecordSellerAnswerResultAction: (...a: unknown[]) => answer(...a),
  adminSendReofferResultAction: (...a: unknown[]) => send(...a),
  adminWithdrawReofferResultAction: (...a: unknown[]) => withdraw(...a),
}));
vi.mock("@/lib/actions/admin", () => ({
  adminReturnLotToInventoryResultAction: (...a: unknown[]) => returnToInventory(...a),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: (title: string) => notifySuccess(title), error: vi.fn() },
}));
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({ redirectToHostedReauth: vi.fn() }));

const lot = { id: "lot-1", title: "The Winter Study", status: "ended" as const, hasWinner: false };

function bundle(offers = [offer()], preview = PREVIEW): LotReofferBundle {
  return { status: "ready", buyerDefault: BUYER_DEFAULT, offers, preview };
}

function renderCard(b: LotReofferBundle, access = { canAct: true, canRecordAnswer: true }) {
  return render(<ReofferCardSection bundle={b} lot={lot} {...access} />);
}

const ready = offer({ status: "ready", consentStatus: "given" });

beforeEach(() => {
  for (const fn of [refresh, start, answer, send, withdraw, returnToInventory, notifySuccess])
    fn.mockReset();
  for (const fn of [answer, send, withdraw, returnToInventory]) fn.mockResolvedValue({ ok: true });
  start.mockResolvedValue({ ok: true, data: { status: "awaiting_seller" } });
});

describe("the Re-offer card on the lot page", () => {
  it("shows the offer's state, its steps and the actions that fit", () => {
    renderCard(bundle());
    expect(screen.getByRole("heading", { name: "Re-offer" })).toBeInTheDocument();
    expect(screen.getByText("Waiting for the seller")).toBeInTheDocument();
    expect(screen.getByText("Offer 1 of up to 3")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Re-offer steps" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Record seller's answer…" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Withdraw…" })).toBeInTheDocument();
  });

  it("says it could not load, keeps the lot as it was, and tries again on request", () => {
    renderCard({ status: "failed" });
    expect(screen.getByText("We couldn't load this re-offer.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refresh).toHaveBeenCalled();
  });

  it("shows nothing for a lot with no default", () => {
    const { container } = renderCard({ ...bundle(), buyerDefault: null });
    expect(container).toBeEmptyDOMElement();
  });

  it("shows read-only staff the card with no buttons and who can act", () => {
    renderCard(bundle([ready]), { canAct: false, canRecordAnswer: false });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(
      screen.getByText("Only Sales managers, Finance and Administrators can act on a re-offer."),
    ).toBeInTheDocument();
  });

  describe("starting an offer", () => {
    it("asks first, then starts it and says the seller has been asked", async () => {
      renderCard(bundle([], PREVIEW));
      fireEvent.click(screen.getByRole("button", { name: "Offer to the next bidder…" }));
      expect(
        screen.getByRole("heading", { name: "Offer The Winter Study to the next bidder?" }),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Offer to the next bidder" }));
      await waitFor(() => expect(start).toHaveBeenCalledWith("lot-1"));
      await waitFor(() =>
        expect(notifySuccess).toHaveBeenCalledWith("Re-offer started: the seller has been asked"),
      );
      expect(refresh).toHaveBeenCalled();
    });

    it("says nobody can be offered the lot, and only offers to return it", () => {
      renderCard(bundle([], NO_PREVIEW));
      expect(screen.getByText("No one else bid on this lot.")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Offer to the next bidder…" }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Return to inventory…" })).toBeInTheDocument();
    });
  });

  describe("recording the seller's answer", () => {
    const open = () =>
      fireEvent.click(screen.getByRole("button", { name: "Record seller's answer…" }));

    it("asks for a note before anything is sent, with the inline message", () => {
      renderCard(bundle());
      open();
      fireEvent.click(screen.getByRole("button", { name: "Record answer" }));
      expect(screen.getByText("Enter a note")).toBeInTheDocument();
      expect(answer).not.toHaveBeenCalled();
    });

    it("records a yes with how they told us kept at the front of the note", async () => {
      renderCard(bundle());
      open();
      fireEvent.change(screen.getByLabelText("Note"), {
        target: { value: "Spoke to Priya at 10am" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Record answer" }));
      await waitFor(() =>
        expect(answer).toHaveBeenCalledWith("lot-1", "offer-1", {
          answer: "given",
          note: "Phone: Spoke to Priya at 10am",
        }),
      );
      await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith("Seller's answer recorded"));
    });

    it("records a no and asks what they would like instead", async () => {
      renderCard(bundle());
      open();
      fireEvent.click(screen.getByRole("radio", { name: "They don't agree" }));
      expect(screen.getByText("What they'd like instead")).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText("Note"), {
        target: { value: "Prefers a later sale" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Record answer" }));
      await waitFor(() =>
        expect(answer).toHaveBeenCalledWith("lot-1", "offer-1", {
          answer: "refused",
          note: "Phone: Prefers a later sale",
        }),
      );
    });

    it("keeps a refusal in the dialog with what was typed, and explains a clash with another staff member", async () => {
      answer.mockResolvedValue({ ok: false, error: "raw", errorCode: "conflict" });
      renderCard(bundle());
      open();
      fireEvent.change(screen.getByLabelText("Note"), { target: { value: "Spoke to Priya" } });
      fireEvent.click(screen.getByRole("button", { name: "Record answer" }));
      expect(
        await screen.findByText(
          "That did not go through. Someone else changed this re-offer. Reload to see where it is.",
        ),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Note")).toHaveValue("Spoke to Priya");
    });
  });

  describe("sending the offer", () => {
    const open = () => fireEvent.click(screen.getByRole("button", { name: "Send offer…" }));

    it("shows what the bidder will pay and sends for three days unless staff choose otherwise", async () => {
      renderCard(bundle([ready]));
      open();
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("Send the offer to Northbank Gallery?")).toBeInTheDocument();
      expect(within(dialog).getByText("£82,000.00")).toBeInTheDocument();
      expect(within(dialog).getByText("£106,600.00")).toBeInTheDocument();
      expect(within(dialog).getByText(/^Seller agreed/)).toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole("button", { name: "Send offer" }));
      await waitFor(() => expect(send).toHaveBeenCalledWith("lot-1", "offer-1", { offerDays: 3 }));
      await waitFor(() =>
        expect(notifySuccess).toHaveBeenCalledWith("Offer sent to Northbank Gallery"),
      );
    });

    it("blocks sending when the account is unavailable and offers to choose the next bidder", async () => {
      send.mockResolvedValue({
        ok: false,
        error: "This account is suspended",
        errorCode: "bidder_unavailable",
      });
      renderCard(bundle([ready]));
      open();
      const dialog = screen.getByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Send offer" }));
      expect(await within(dialog).findByText("This account is suspended")).toBeInTheDocument();
      const sendAgain = within(dialog).getByRole("button", { name: "Send offer" });
      expect(sendAgain).toHaveAttribute("aria-disabled", "true");
      fireEvent.click(within(dialog).getByRole("button", { name: "Choose the next bidder" }));
      expect(
        await screen.findByRole("heading", { name: "Withdraw the offer to Northbank Gallery?" }),
      ).toBeInTheDocument();
    });
  });

  describe("withdrawing", () => {
    it("needs a reason and says who is told", async () => {
      renderCard(bundle([ready]));
      fireEvent.click(screen.getByRole("button", { name: "Withdraw…" }));
      expect(screen.getByText(/nobody is told/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Withdraw offer" }));
      expect(withdraw).not.toHaveBeenCalled();
      fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Seller away" } });
      fireEvent.click(screen.getByRole("button", { name: "Withdraw offer" }));
      await waitFor(() =>
        expect(withdraw).toHaveBeenCalledWith("lot-1", "offer-1", { note: "Seller away" }),
      );
      await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith("Offer withdrawn"));
    });

    it("tells staff the bidder hears of it when the offer is already out", () => {
      renderCard(
        bundle([
          offer({
            status: "offered",
            consentStatus: "given",
            offerSentAt: "2026-11-11T10:00:00.000Z",
            offerEndsAt: "2026-11-14T17:00:00.000Z",
          }),
        ]),
      );
      fireEvent.click(screen.getByRole("button", { name: "Withdraw…" }));
      expect(
        screen.getByText(/The bidder is told the offer has been withdrawn/),
      ).toBeInTheDocument();
    });
  });

  it("returns the lot to inventory through the same confirm as the lot menu", async () => {
    renderCard(bundle([offer({ status: "seller_declined", consentStatus: "refused" })]));
    fireEvent.click(screen.getByRole("button", { name: "Return to inventory…" }));
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Seller declined" } });
    fireEvent.click(screen.getByRole("button", { name: "Return to inventory" }));
    await waitFor(() =>
      expect(returnToInventory).toHaveBeenCalledWith("lot-1", {
        reason: "Seller declined",
        confirmVoided: false,
      }),
    );
  });
});
