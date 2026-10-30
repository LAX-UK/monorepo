import { LotOnBlockPanel } from "@/features/saleroom/components/clerk-console/lot-on-block-panel";
import type { ClerkLotLiveBidState } from "@/hooks/use-clerk-lot-live-price";
import type { Lot } from "@auction/types";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { placePaddleBid, entry } = vi.hoisted(() => ({
  placePaddleBid: vi.fn(),
  entry: { paddleNumber: "", paddleAmount: "", telephoneAmount: "" },
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
});
