/**
 * Tests for ArtworkBidPanel in "videoCompact" surface (bid-while-watching stream).
 * Uses the same mock infrastructure as artwork-bid-panel.test.tsx.
 */
import { BidPanelSurfaceProvider } from "@/components/sections/artwork/online/bid-panel-surface";
import { LotBidHistoryProvider } from "@/lib/context/lot-bid-history-provider";
import type { Lot } from "@auction/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArtworkBidPanel } from "./artwork-bid-panel";

// ─── Mocks (same pattern as artwork-bid-panel.test.tsx) ──────────────────────

const placeBidMock = vi.fn();

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
      setAutoBid: vi.fn(),
      clearAutoBid: vi.fn(),
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
    setLiveEndTimeMs: vi.fn(),
    setLiveLotStatus: vi.fn(),
    bidCardInView: true,
    setBidCardInView: vi.fn(),
  }),
}));

vi.mock("@/lib/connection/use-live-connection", () => ({
  useLiveConnection: () => ({
    state: "live",
    message: null,
    biddingAllowed: true,
    realtimeHealthy: true,
  }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const liveLot = (): Lot => ({
  id: "lot-x",
  saleId: null,
  lotNumber: 1,
  sellerId: "other-seller",
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

const buyerSession = {
  id: "buyer-1",
  email: "b@b.co",
  name: "Buyer",
  role: "client" as const,
};

const summarySeed = {
  title: "Piece",
  kicker: null,
  estimateLine: null,
  sellerName: "Seller",
  sellerHref: "/artist/other-artist/other",
  sellerImageUrl: null,
};

function renderCompact(props: Partial<ComponentProps<typeof ArtworkBidPanel>> = {}) {
  const auction = props.auction ?? liveLot();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LotBidHistoryProvider
        lotId={auction.id}
        initialHistory={props.initialHistory ?? []}
        initialCurrentPrice={auction.currentPrice}
        initialLeadingBidderId={null}
        currentUserId={props.sessionUser?.id ?? null}
      >
        <BidPanelSurfaceProvider surface="videoCompact">
          <ArtworkBidPanel
            auction={auction}
            initialHistory={[]}
            sessionUser={buyerSession}
            summarySeed={summarySeed}
            initialAutoBidSettings={null}
            {...props}
          />
        </BidPanelSurfaceProvider>
      </LotBidHistoryProvider>
    </QueryClientProvider>,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ArtworkBidPanel — videoCompact surface", () => {
  beforeEach(() => {
    placeBidMock.mockReset();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("shows current bid, min next bid, and a Bid button", () => {
    renderCompact();

    expect(screen.getByText(/current bid/i)).toBeInTheDocument();
    expect(screen.getByText("£100.00")).toBeInTheDocument();
    expect(screen.getByText(/min next/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^bid$/i })).toBeInTheDocument();
  });

  it("does NOT render the BidStickyMobileBar (no duplicate bar)", () => {
    renderCompact();

    // The sticky mobile bar renders a "Review bid" CTA when live and allowed.
    // In compact mode it must be suppressed entirely.
    // MarketingStickyBidBar is a fixed-position bar — verify it's absent.
    expect(screen.queryByRole("region", { name: /sticky bid bar/i })).not.toBeInTheDocument();
    // A simpler proxy: the sticky bar always shows the exact text "Current bid" in a label
    // AND a separate "Review bid" or price+label in its structure. The compact bar itself
    // shows "Current bid" so we check that only ONE appears (the compact bar, not a duplicate).
    const currentBidLabels = screen.getAllByText(/current bid/i);
    expect(currentBidLabels).toHaveLength(1);
  });

  it("expands the bid form inline when Bid button is clicked", () => {
    renderCompact();

    expect(screen.queryByRole("button", { name: /review bid/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^bid$/i }));

    // Manual bid form should appear
    expect(screen.getByRole("button", { name: /review bid/i })).toBeInTheDocument();
  });

  it("collapses the form when Close is clicked", () => {
    renderCompact();

    fireEvent.click(screen.getByRole("button", { name: /^bid$/i }));
    expect(screen.getByRole("button", { name: /review bid/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByRole("button", { name: /review bid/i })).not.toBeInTheDocument();
    // Bid button is back
    expect(screen.getByRole("button", { name: /^bid$/i })).toBeInTheDocument();
  });

  it("places a bid through the expand → review → confirm flow using the same placeBid", async () => {
    placeBidMock.mockResolvedValue({
      ok: true,
      bid: {
        id: "bid-1",
        amount: "110",
        isWinning: true,
        maxAutoBidAmount: null,
        autoBidStepAmount: null,
        createdAt: new Date(),
      },
    });

    renderCompact();

    // Expand (this also switches to manual mode and sets amount to minNumeric)
    fireEvent.click(screen.getByRole("button", { name: /^bid$/i }));

    // Ensure the amount is set via the "Min" chip (which calls onUseMinimum → setAmount)
    fireEvent.click(screen.getByRole("button", { name: /^min/i }));

    // Review
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /review bid/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /review bid/i }));

    // BidConfirmation shows "Place bid"
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /place bid/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /place bid/i }));

    await waitFor(() => {
      expect(placeBidMock).toHaveBeenCalledWith(
        expect.objectContaining({ lotId: "lot-x", amount: 110 }),
      );
    });
  });

  it("shows the block message instead of form when decision blocks bidding", () => {
    renderCompact({ sessionUser: null });

    expect(screen.getByText(/sign in to place a bid/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^bid$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /review bid/i })).not.toBeInTheDocument();
    expect(placeBidMock).not.toHaveBeenCalled();
  });

  it("shows strict email eligibility inline with no video bid action", () => {
    renderCompact({
      strictBidEligibilityEnabled: true,
      sessionUser: { ...buyerSession, emailVerified: false, kycStatus: "unverified" },
    });

    expect(screen.getByText("Email verification required")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send verification email" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^bid$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /review bid/i })).not.toBeInTheDocument();
  });

  it("id='lot-bid-entry' is NOT present in the DOM in compact surface (no duplicate id)", () => {
    renderCompact();
    expect(document.getElementById("lot-bid-entry")).toBeNull();
  });
});
