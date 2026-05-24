import type { Lot } from "@auction/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArtworkBidPanel } from "./artwork-bid-panel";

const placeBidMock = vi.fn();
const setAutoBidMock = vi.fn();
const clearAutoBidMock = vi.fn();

vi.mock("@/hooks/use-lot-realtime", () => ({
  useLotRealtime: vi.fn(),
}));

vi.mock("@/lib/context/lot-ports", () => ({
  useLotPorts: () => ({
    bidWriter: {
      placeBid: (...args: unknown[]) => placeBidMock(...args),
    },
    autoBidWriter: {
      getAutoBid: vi.fn().mockResolvedValue(null),
      setAutoBid: (...args: unknown[]) => setAutoBidMock(...args),
      clearAutoBid: (...args: unknown[]) => clearAutoBidMock(...args),
    },
    realtime: {
      subscribeToLot: () => () => {},
      leaveLot: () => {},
    },
    health: {
      subscribe: () => () => {},
      probe: () => {},
      setBidPropagationLotId: () => {},
    },
  }),
}));

vi.mock("@/lib/context/online-lot-lifecycle", () => ({
  useOnlineLotLifecycle: () => ({
    extendedByMs: null,
    setExtendedDeltaMs: vi.fn(),
    bidCardInView: true,
    setBidCardInView: vi.fn(),
  }),
}));

const lot = (sellerId: string): Lot => ({
  id: "lot-x",
  saleId: null,
  lotNumber: 1,
  sellerId,
  title: "Piece",
  description: null,
  medium: null,
  dimensions: null,
  images: [],
  categoryId: "c",
  auctionType: "english",
  startingPrice: "100",
  reservePrice: null,
  buyNowPrice: null,
  currentPrice: "100",
  buyerPremiumRate: "0.25",
  minBidIncrement: "10",
  dutchDecrementAmount: null,
  dutchDecrementIntervalMs: 0,
  dutchLastDecrementAt: null,
  startTime: new Date(),
  endTime: new Date(Date.now() + 86_400_000),
  status: "active",
  winnerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  marketingDetails: {},
});

describe("ArtworkBidPanel", () => {
  beforeEach(() => {
    placeBidMock.mockReset();
  });

  it("shows seller notice instead of bid form when user is the seller", () => {
    const sellerId = "user-seller-1";
    render(
      <ArtworkBidPanel
        auction={lot(sellerId)}
        initialHistory={[]}
        sessionUser={{
          id: sellerId,
          email: "a@b.co",
          name: "Seller",
          role: "client",
        }}
        summarySeed={{
          title: "Piece",
          kicker: null,
          estimateLine: null,
          sellerName: "Seller",
          sellerHref: "/artist/other-artist/other",
          sellerImageUrl: null,
        }}
        initialAutoBidSettings={null}
      />,
    );
    expect(screen.getByText(/this is your listing/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /review bid/i })).not.toBeInTheDocument();
  });

  it("shows bid form for a buyer", () => {
    render(
      <ArtworkBidPanel
        auction={lot("other-seller")}
        initialHistory={[]}
        sessionUser={{
          id: "buyer-1",
          email: "b@b.co",
          name: "Buyer",
          role: "client",
        }}
        summarySeed={{
          title: "Piece",
          kicker: null,
          estimateLine: null,
          sellerName: "Seller",
          sellerHref: "/artist/other-artist/other",
          sellerImageUrl: null,
        }}
        initialAutoBidSettings={null}
      />,
    );
    expect(screen.getByRole("button", { name: /review bid/i })).toBeInTheDocument();
  });

  it("hides auto-bid panel when lot is scheduled", () => {
    const scheduled = {
      ...lot("other-seller"),
      status: "scheduled" as const,
      startTime: new Date(Date.now() + 86_400_000),
    };
    render(
      <ArtworkBidPanel
        auction={scheduled}
        initialHistory={[]}
        sessionUser={{
          id: "buyer-1",
          email: "b@b.co",
          name: "Buyer",
          role: "client",
        }}
        summarySeed={{
          title: "Piece",
          kicker: null,
          estimateLine: null,
          sellerName: "Seller",
          sellerHref: "/artist/other-artist/other",
          sellerImageUrl: null,
        }}
        initialAutoBidSettings={null}
      />,
    );
    expect(screen.queryByText(/save auto-bid/i)).not.toBeInTheDocument();
    expect(screen.getByText(/auto-bid opens when this lot goes live/i)).toBeInTheDocument();
  });

  it("shows auto-bid panel when lot is active and live", () => {
    render(
      <ArtworkBidPanel
        auction={lot("other-seller")}
        initialHistory={[]}
        sessionUser={{
          id: "buyer-1",
          email: "b@b.co",
          name: "Buyer",
          role: "client",
        }}
        summarySeed={{
          title: "Piece",
          kicker: null,
          estimateLine: null,
          sellerName: "Seller",
          sellerHref: "/artist/other-artist/other",
          sellerImageUrl: null,
        }}
        initialAutoBidSettings={null}
      />,
    );
    expect(screen.getByText(/^Auto-bid$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save auto-bid/i })).toBeInTheDocument();
  });

  it("submits a bid on confirm and shows success", async () => {
    placeBidMock.mockResolvedValueOnce({
      ok: true,
      bid: {
        id: "bid-ok",
        lotId: "lot-x",
        amount: "110",
        bidderId: "buyer-1",
        placedByUserId: "buyer-1",
        isWinning: true,
        isAutoBid: false,
        maxAutoBidAmount: null,
        createdAt: new Date(),
      },
    });
    render(
      <ArtworkBidPanel
        auction={lot("other-seller")}
        initialHistory={[]}
        sessionUser={{
          id: "buyer-1",
          email: "b@b.co",
          name: "Buyer",
          role: "client",
        }}
        summarySeed={{
          title: "Piece",
          kicker: null,
          estimateLine: null,
          sellerName: "Seller",
          sellerHref: "/artist/other-artist/other",
          sellerImageUrl: null,
        }}
        initialAutoBidSettings={null}
        omitPricingHeader
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /review bid/i }));
    fireEvent.click(screen.getByRole("button", { name: /place bid/i }));
    await waitFor(() => {
      expect(placeBidMock).toHaveBeenCalledWith(
        expect.objectContaining({
          lotId: "lot-x",
          amount: expect.any(Number),
          idempotencyKey: expect.any(String),
        }),
      );
    });
    expect(await screen.findByText(/bid placed successfully/i)).toBeInTheDocument();
  });

  it("reuses the same idempotency key for repeated confirm attempts", async () => {
    placeBidMock.mockResolvedValue({
      ok: false,
      error: "Bid still processing; retry shortly",
      code: "bid_in_flight",
    });
    render(
      <ArtworkBidPanel
        auction={lot("other-seller")}
        initialHistory={[]}
        sessionUser={{
          id: "buyer-1",
          email: "b@b.co",
          name: "Buyer",
          role: "client",
        }}
        summarySeed={{
          title: "Piece",
          kicker: null,
          estimateLine: null,
          sellerName: "Seller",
          sellerHref: "/artist/other-artist/other",
          sellerImageUrl: null,
        }}
        initialAutoBidSettings={null}
        omitPricingHeader
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /review bid/i }));
    fireEvent.click(screen.getByRole("button", { name: /place bid/i }));
    await waitFor(() => expect(placeBidMock).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /place bid/i })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole("button", { name: /place bid/i }));
    await waitFor(() => expect(placeBidMock).toHaveBeenCalledTimes(2));
    const keys = placeBidMock.mock.calls.map((call) => call[0]?.idempotencyKey);
    expect(keys[0]).toBeTruthy();
    expect(keys.every((key) => key === keys[0])).toBe(true);
  });

  it("blocks review when bid exceeds approved registration limit", () => {
    render(
      <ArtworkBidPanel
        auction={lot("other-seller")}
        initialHistory={[]}
        sessionUser={{
          id: "buyer-1",
          email: "b@b.co",
          name: "Buyer",
          role: "client",
        }}
        summarySeed={{
          title: "Piece",
          kicker: null,
          estimateLine: null,
          sellerName: "Seller",
          sellerHref: "/artist/other-artist/other",
          sellerImageUrl: null,
        }}
        initialAutoBidSettings={null}
        saleRegistrationBidGate={{
          saleId: "sale-1",
          requiresRegistration: true,
          actingEntityId: "le-agent",
          registrationStatus: "approved",
          approvedBidLimit: 500,
          buyerEntities: [{ id: "le-agent", displayName: "Agency", memberRole: "buyer_agent" }],
          myRegistrations: [
            { buyerLegalEntityId: "le-agent", status: "approved", bidLimit: "500.00" },
          ],
          kycApproved: true,
        }}
      />,
    );
    const input = screen.getByPlaceholderText("0.00");
    fireEvent.change(input, { target: { value: "600" } });
    fireEvent.click(screen.getByRole("button", { name: /review bid/i }));
    expect(screen.getByText(/approved limit for this sale is/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /place bid/i })).not.toBeInTheDocument();
  });
});
