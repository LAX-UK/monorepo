import { LotOnBlockPanel } from "@/features/saleroom/components/clerk-console/lot-on-block-panel";
import type { ClerkLotLiveBidState } from "@/hooks/use-clerk-lot-live-price";
import type { Lot } from "@auction/types";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { placePaddleBid } = vi.hoisted(() => ({ placePaddleBid: vi.fn() }));

vi.mock("@/features/saleroom/hooks/use-clerk-bid-entry", () => ({
  useClerkBidEntry: () => ({
    state: {
      paddleNumber: "",
      paddleAmount: "",
      telephoneAmount: "",
      bookingId: "",
    },
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
});
