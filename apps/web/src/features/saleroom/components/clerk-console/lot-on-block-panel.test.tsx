import { LotOnBlockPanel } from "@/features/saleroom/components/clerk-console/lot-on-block-panel";
import type { ClerkLotLiveBidState } from "@/hooks/use-clerk-lot-live-price";
import type { Lot } from "@auction/types";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { placePaddleBid, entry, refused } = vi.hoisted(() => ({
  placePaddleBid: vi.fn(),
  entry: { paddleNumber: "", paddleAmount: "", telephoneAmount: "" },
  refused: { current: null as unknown },
}));

vi.mock("@/features/saleroom/hooks/use-clerk-bid-entry", () => ({
  useClerkBidEntry: () => ({
    state: { ...entry, bookingId: "" },
    pending: false,
    incrementOptions: [110, 120, 150],
    inProgressBookings: [
      {
        id: "booking-1",
        userName: "Tel buyer",
        userEmail: null,
        userId: "user-1",
      },
    ],
    registeredPaddle: null,
    paddleRegistrationError: null,
    limitRefusal: refused.current,
    canPlacePaddleBid: false,
    canPlaceTelephoneBid: false,
    setPaddleNumber: vi.fn(),
    setPaddleAmount: vi.fn(),
    setTelephoneAmount: vi.fn(),
    setBookingId: vi.fn(),
    applyIncrement: vi.fn(),
    placePaddleBid,
    placeTelephoneBid: vi.fn(),
  }),
}));

const liveBid: ClerkLotLiveBidState = {
  currentPrice: "100.00",
  bidCount: 0,
  leaderUserId: null,
  leaderAmount: null,
  placedVia: null,
  leaderLabel: null,
};

const lots: Lot[] = [
  {
    id: "lot-1",
    saleId: "sale-1",
    lotNumber: 1,
    title: "Lot one",
    status: "active",
    currentPrice: "100",
    winnerId: null,
  } as Lot,
];

describe("LotOnBlockPanel", () => {
  it("shows paused message and disables bid controls when session is paused", () => {
    render(
      <LotOnBlockPanel
        saleId="sale-1"
        currentLotId="lot-1"
        lots={lots}
        telephoneBookings={[]}
        liveBid={liveBid}
        sessionLive
        sessionStatus="paused"
      />,
    );

    expect(screen.getByText("Session paused — resume to place bids.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Place paddle bid" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Place telephone bid" })).toBeDisabled();
    expect(screen.getByLabelText("Paddle number")).toBeDisabled();
    expect(document.getElementById("paddle-bid-amount-sale-1")).toBeDisabled();
  });

  it("keeps bid controls enabled when session is live", () => {
    render(
      <LotOnBlockPanel
        saleId="sale-1"
        currentLotId="lot-1"
        lots={lots}
        telephoneBookings={[]}
        liveBid={liveBid}
        sessionLive
        sessionStatus="live"
      />,
    );

    expect(screen.queryByText("Session paused — resume to place bids.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Paddle number")).not.toBeDisabled();
  });

  it("places the paddle bid when Enter is pressed in the paddle or amount field", () => {
    placePaddleBid.mockClear();
    render(
      <LotOnBlockPanel
        saleId="sale-1"
        currentLotId="lot-1"
        lots={lots}
        telephoneBookings={[]}
        liveBid={liveBid}
        sessionLive
        sessionStatus="live"
      />,
    );

    fireEvent.keyDown(screen.getByLabelText("Paddle number"), { key: "Enter" });
    fireEvent.keyDown(document.getElementById("paddle-bid-amount-sale-1") as HTMLElement, {
      key: "Enter",
    });
    expect(placePaddleBid).toHaveBeenCalledTimes(2);
  });

  it("names the quick amounts for assistive technology", () => {
    render(
      <LotOnBlockPanel
        saleId="sale-1"
        currentLotId="lot-1"
        lots={lots}
        telephoneBookings={[]}
        liveBid={liveBid}
        sessionLive
        sessionStatus="live"
      />,
    );

    expect(screen.getAllByRole("button", { name: "Minimum bid £110.00" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "2 increments up, £120.00" })).toHaveLength(2);
  });

  describe("lot actions dock", () => {
    const renderDock = ({ hammerPrimary }: { hammerPrimary: boolean }) => (
      <section aria-label="Lot actions" data-hammer-primary={String(hammerPrimary)} />
    );
    const reserveLots = [{ ...lots[0], reservePrice: "100" } as Lot];

    function renderPanel(overrides: Partial<Parameters<typeof LotOnBlockPanel>[0]> = {}) {
      render(
        <LotOnBlockPanel
          saleId="sale-1"
          currentLotId="lot-1"
          lots={reserveLots}
          telephoneBookings={[]}
          liveBid={liveBid}
          sessionLive
          sessionStatus="live"
          renderDock={renderDock}
          {...overrides}
        />,
      );
    }
    const dock = () => screen.getByRole("region", { name: "Lot actions" });

    it("docks the lot actions inside the panel, after the bid form", () => {
      entry.paddleNumber = "";
      entry.paddleAmount = "";
      renderPanel();
      const place = screen.getByRole("button", { name: "Place paddle bid" });
      expect(place.compareDocumentPosition(dock()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("makes Hammer the primary action when the form is empty and the reserve is met", () => {
      entry.paddleNumber = "";
      entry.paddleAmount = "";
      renderPanel();
      expect(dock()).toHaveAttribute("data-hammer-primary", "true");
    });

    it("keeps Hammer secondary while the reserve is not met", () => {
      entry.paddleNumber = "";
      entry.paddleAmount = "";
      renderPanel({ lots: [{ ...lots[0], reservePrice: "500" } as Lot] });
      expect(dock()).toHaveAttribute("data-hammer-primary", "false");
    });

    it("makes Place paddle bid the only primary action while a bid is being entered", () => {
      entry.paddleNumber = "142";
      entry.paddleAmount = "";
      renderPanel();
      expect(dock()).toHaveAttribute("data-hammer-primary", "false");
      expect(screen.getByRole("button", { name: "Place paddle bid" })).toHaveClass("bg-lax-ink");
      entry.paddleNumber = "";
    });

    it("keeps Place paddle bid secondary when nothing is entered", () => {
      entry.paddleNumber = "";
      entry.paddleAmount = "";
      renderPanel();
      expect(screen.getByRole("button", { name: "Place paddle bid" })).not.toHaveClass(
        "bg-lax-ink",
      );
    });
  });

  describe("a bid a limit refused", () => {
    afterEach(() => {
      refused.current = null;
    });

    const panel = () => (
      <LotOnBlockPanel
        saleId="sale-1"
        currentLotId="lot-1"
        lots={lots}
        telephoneBookings={[]}
        liveBid={liveBid}
        sessionLive
        sessionStatus="live"
      />
    );
    const renderPanel = () => render(panel());

    it("says above the paddle form whose bid, which limit and what to do next", () => {
      refused.current = {
        channel: "paddle",
        refusal: { kind: "paddle", limit: "5000.00", available: null },
        bidder: "Paddle 142",
        amount: 6000,
      };
      renderPanel();

      const notice = screen.getByRole("alert");
      expect(notice).toHaveTextContent("Paddle 142's bid of £6,000.00 wasn't placed");
      expect(notice).toHaveTextContent("The paddle's limit for this sale is £5,000.00.");
      expect(notice).toHaveTextContent("Take a bid within the limit.");
      // FBK-1: above the section it concerns, under the group's title and before its inputs.
      const title = screen.getByRole("heading", { name: "Paddle bid" });
      const paddleInput = screen.getByLabelText("Paddle number");
      expect(title.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(
        notice.compareDocumentPosition(paddleInput) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("gives only the room left on this lot for the organisation's limit, above the telephone form", () => {
      refused.current = {
        channel: "telephone",
        refusal: { kind: "organisation", limit: null, available: "2000.00" },
        bidder: "Tel buyer",
        amount: 4000,
      };
      renderPanel();

      const notice = screen.getByRole("alert");
      expect(notice).toHaveTextContent(
        "It's above what their organisation's bidding limit allows. They can bid up to £2,000.00 on this lot.",
      );
      expect(notice).toHaveTextContent("Only the organisation's owners or admins can raise it.");
      expect(notice).not.toHaveTextContent("50,000");
      const title = screen.getByRole("heading", { name: "Telephone bid" });
      const line = screen.getByText("Telephone line");
      expect(title.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(notice.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      const button = screen.getByRole("button", { name: "Place telephone bid" });
      expect(
        notice.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("says the buyer's approved registration limit by the telephone form", () => {
      refused.current = {
        channel: "telephone",
        refusal: { kind: "registration", limit: "5000.00", available: null },
        bidder: "Tel buyer",
        amount: 9000,
      };
      renderPanel();

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Tel buyer's bid of £9,000.00 wasn't placedTheir approved limit for this sale is £5,000.00. Take a bid within the limit. To bid higher, their registration limit must be raised first.",
      );
    });

    it("mounts a new alert when the same refusal comes back after being cleared", () => {
      const state = {
        channel: "paddle",
        refusal: { kind: "paddle", limit: "5000.00", available: null },
        bidder: "Paddle 142",
        amount: 6000,
      };
      refused.current = state;
      const view = renderPanel();
      const first = screen.getByRole("alert");
      refused.current = null;
      view.rerender(panel());
      expect(screen.queryByRole("alert")).toBeNull();
      refused.current = { ...state };
      view.rerender(panel());
      expect(screen.getByRole("alert")).not.toBe(first);
    });

    it("shows nothing when no limit refused a bid", () => {
      renderPanel();
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });
});
