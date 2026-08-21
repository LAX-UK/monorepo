import { LotBidHistoryProvider } from "@/lib/context/lot-bid-history-provider";
import type { Lot } from "@auction/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
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

/** Default entry mode is auto-bid; switch to manual before using the bid form. */
function selectManualBidMode() {
  fireEvent.click(screen.getByRole("button", { name: /place one bid now/i }));
}

function selectAutoBidMode() {
  fireEvent.click(screen.getByRole("button", { name: /^Auto-bid/i }));
}

function renderArtworkBidPanel(props: ComponentProps<typeof ArtworkBidPanel>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LotBidHistoryProvider
        lotId={props.auction.id}
        initialHistory={props.initialHistory}
        initialCurrentPrice={props.auction.currentPrice}
        initialLeadingBidderId={props.initialLeadingBidderId ?? null}
        currentUserId={props.sessionUser?.id ?? null}
      >
        <ArtworkBidPanel {...props} />
      </LotBidHistoryProvider>
    </QueryClientProvider>,
  );
}

describe("ArtworkBidPanel", () => {
  beforeEach(() => {
    placeBidMock.mockReset();
    setAutoBidMock.mockReset();
    clearAutoBidMock.mockReset();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("shows seller notice instead of bid form when user is the seller", () => {
    const sellerId = "user-seller-1";
    renderArtworkBidPanel({
      auction: lot(sellerId),
      initialHistory: [],
      sessionUser: {
        id: sellerId,
        email: "a@b.co",
        name: "Seller",
        role: "client",
      },
      summarySeed,
      initialAutoBidSettings: null,
    });
    expect(screen.getAllByText(/your listing/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /review bid/i })).not.toBeInTheDocument();
  });

  it("shows bid form for a buyer", () => {
    renderArtworkBidPanel({
      auction: lot("other-seller"),
      initialHistory: [],
      sessionUser: buyerSession,
      summarySeed,
      initialAutoBidSettings: null,
    });
    selectManualBidMode();
    expect(screen.getByRole("button", { name: /review bid/i })).toBeInTheDocument();
  });

  it("hides auto-bid panel when lot is scheduled", () => {
    const scheduled = {
      ...lot("other-seller"),
      status: "scheduled" as const,
      startTime: new Date(Date.now() + 86_400_000),
    };
    renderArtworkBidPanel({
      auction: scheduled,
      initialHistory: [],
      sessionUser: buyerSession,
      summarySeed,
      initialAutoBidSettings: null,
    });
    expect(screen.queryByText(/save auto-bid/i)).not.toBeInTheDocument();
    expect(screen.getByText(/auto-bid opens when this lot goes live/i)).toBeInTheDocument();
  });

  it("shows auto-bid panel when lot is active and live", () => {
    renderArtworkBidPanel({
      auction: lot("other-seller"),
      initialHistory: [],
      sessionUser: buyerSession,
      summarySeed,
      initialAutoBidSettings: null,
    });
    expect(screen.getByRole("button", { name: /save auto-bid/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/max amount/i)).toBeInTheDocument();
  });

  it("replaces auto and manual controls with the strict email blocker", () => {
    renderArtworkBidPanel({
      auction: lot("other-seller"),
      initialHistory: [],
      sessionUser: { ...buyerSession, emailVerified: false, kycStatus: "unverified" },
      summarySeed,
      initialAutoBidSettings: null,
      strictBidEligibilityEnabled: true,
    });

    expect(screen.getAllByText("Email verification required").length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: /send verification email|verify email/i }).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByLabelText(/max amount/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /review bid/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save auto-bid/i })).not.toBeInTheDocument();
  });

  it("shows strict KYC approval action in panel and sticky surfaces", () => {
    renderArtworkBidPanel({
      auction: lot("other-seller"),
      initialHistory: [],
      sessionUser: { ...buyerSession, emailVerified: true, kycStatus: "pending" },
      summarySeed,
      initialAutoBidSettings: null,
      strictBidEligibilityEnabled: true,
    });

    expect(
      screen.getByText("Your identity must be approved before you can place bids."),
    ).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: /verify|verification|identity/i });
    expect(
      links.some(
        (link) =>
          link.getAttribute("href") ===
          "/onboarding/identity?next=%2Flot%2Fpiece%2Flot-x&source=bid_gate&lot=lot-x",
      ),
    ).toBe(true);
    expect(screen.queryByRole("button", { name: /review bid/i })).not.toBeInTheDocument();
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
    renderArtworkBidPanel({
      auction: lot("other-seller"),
      initialHistory: [],
      sessionUser: buyerSession,
      summarySeed,
      initialAutoBidSettings: null,
      omitPricingHeader: true,
    });
    selectManualBidMode();
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

  it("applies opening auto-bid to live price immediately", async () => {
    setAutoBidMock.mockResolvedValueOnce({
      ok: true,
      settings: {
        maxAutoBidAmount: "500",
        autoBidStepAmount: "10",
        isActive: true,
      },
      placedBid: {
        id: "bid-auto-1",
        amount: "110",
        placedByUserId: "buyer-1",
        maxAutoBidAmount: "500",
        autoBidStepAmount: "10",
      },
    });
    renderArtworkBidPanel({
      auction: lot("other-seller"),
      initialHistory: [],
      sessionUser: buyerSession,
      summarySeed,
      initialAutoBidSettings: null,
      omitPricingHeader: true,
    });
    fireEvent.change(screen.getByLabelText(/max amount/i), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: /save auto-bid/i }));
    await waitFor(() => expect(setAutoBidMock).toHaveBeenCalled());
    expect(await screen.findByText(/auto-bid saved/i)).toBeInTheDocument();
    expect(screen.getByText(/winning · auto-bid defending/i)).toBeInTheDocument();
    expect(screen.getAllByText(/£110\.00/i).length).toBeGreaterThan(0);
  });

  it("recovers from placeBid network failure without stuck submitting state", async () => {
    placeBidMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    renderArtworkBidPanel({
      auction: lot("other-seller"),
      initialHistory: [],
      sessionUser: buyerSession,
      summarySeed,
      initialAutoBidSettings: null,
      omitPricingHeader: true,
    });
    selectManualBidMode();
    fireEvent.click(screen.getByRole("button", { name: /review bid/i }));
    fireEvent.click(screen.getByRole("button", { name: /place bid/i }));
    await waitFor(() => {
      expect(screen.getByText(/could not reach the server/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /place bid/i })).not.toBeDisabled();
  });

  it("reuses the same idempotency key for repeated confirm attempts", async () => {
    placeBidMock.mockResolvedValue({
      ok: false,
      error: "Bid still processing; retry shortly",
      code: "bid_in_flight",
    });
    renderArtworkBidPanel({
      auction: lot("other-seller"),
      initialHistory: [],
      sessionUser: buyerSession,
      summarySeed,
      initialAutoBidSettings: null,
      omitPricingHeader: true,
    });
    selectManualBidMode();
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

  it("sticky bar offers Raise max when outbid with active auto-bid", () => {
    renderArtworkBidPanel({
      auction: lot("other-seller"),
      initialHistory: [],
      initialLeadingBidderId: "other-bidder",
      initialOutbid: true,
      initialUserHasBid: true,
      sessionUser: buyerSession,
      summarySeed,
      initialAutoBidSettings: {
        maxAutoBidAmount: "500",
        autoBidStepAmount: "10",
        isActive: true,
      },
      omitPricingHeader: true,
    });
    expect(screen.getByRole("button", { name: /raise max/i })).toBeInTheDocument();
  });

  it("reveals manual bid form when Increase bid is clicked while outbid in auto mode", () => {
    renderArtworkBidPanel({
      auction: lot("other-seller"),
      initialHistory: [],
      initialLeadingBidderId: "other-bidder",
      initialOutbid: true,
      initialUserHasBid: true,
      sessionUser: buyerSession,
      summarySeed,
      initialAutoBidSettings: {
        maxAutoBidAmount: "500",
        autoBidStepAmount: "10",
        isActive: true,
      },
      omitPricingHeader: true,
    });
    expect(screen.queryByRole("button", { name: /review bid/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^increase bid$/i }));
    expect(screen.getByRole("button", { name: /review bid/i })).toBeInTheDocument();
  });

  it("shows durable outbid position on SSR when user bid but is not leading", () => {
    renderArtworkBidPanel({
      auction: lot("other-seller"),
      initialHistory: [
        {
          id: "b1",
          bidderId: "buyer-1",
          amount: "110",
          at: Date.now(),
        },
      ],
      initialLeadingBidderId: "other-bidder",
      initialOutbid: true,
      initialUserHasBid: true,
      sessionUser: buyerSession,
      summarySeed,
      initialAutoBidSettings: null,
    });
    expect(screen.getByText(/you've been outbid/i)).toBeInTheDocument();
  });

  it("blocks review when bid exceeds approved registration limit", () => {
    renderArtworkBidPanel({
      auction: lot("other-seller"),
      initialHistory: [],
      sessionUser: buyerSession,
      summarySeed,
      initialAutoBidSettings: null,
      saleRegistrationBidGate: {
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
      },
    });
    selectManualBidMode();
    const input = screen.getByPlaceholderText("0.00");
    fireEvent.change(input, { target: { value: "600" } });
    fireEvent.click(screen.getByRole("button", { name: /review bid/i }));
    expect(screen.getByText(/approved limit for this sale is/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /place bid/i })).not.toBeInTheDocument();
  });

  it("hides auto-bid controls when isOwnLot is true", () => {
    renderArtworkBidPanel({
      auction: {
        ...lot("other-seller"),
        sellerLegalEntityId: "le-seller",
      },
      initialHistory: [],
      sessionUser: buyerSession,
      summarySeed,
      initialAutoBidSettings: null,
      isOwnLot: true,
    });
    expect(screen.queryByText(/save auto-bid/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /place one bid now/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(/your listing/i).length).toBeGreaterThan(0);
  });

  it("blocks manual review when user is already leading", () => {
    renderArtworkBidPanel({
      auction: lot("other-seller"),
      initialHistory: [
        {
          id: "b1",
          bidderId: "buyer-1",
          amount: "110",
          at: Date.now(),
        },
      ],
      initialLeadingBidderId: "buyer-1",
      sessionUser: buyerSession,
      summarySeed,
      initialAutoBidSettings: null,
    });
    selectManualBidMode();
    expect(screen.getAllByText(/already the highest bidder/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /review bid/i })).toBeDisabled();
  });

  it("preserves unsaved auto-bid draft when toggling modes", () => {
    renderArtworkBidPanel({
      auction: lot("other-seller"),
      initialHistory: [],
      sessionUser: buyerSession,
      summarySeed,
      initialAutoBidSettings: null,
      omitPricingHeader: true,
    });

    fireEvent.change(screen.getByLabelText(/max amount/i), { target: { value: "750" } });
    selectManualBidMode();
    selectAutoBidMode();

    expect(screen.getByLabelText(/max amount/i)).toHaveValue("750");
    expect(screen.getByText(/changed your auto-bid/i)).toBeInTheDocument();
  });

  it("preserves manual bid amount when toggling modes", () => {
    renderArtworkBidPanel({
      auction: lot("other-seller"),
      initialHistory: [],
      sessionUser: buyerSession,
      summarySeed,
      initialAutoBidSettings: null,
      omitPricingHeader: true,
    });

    selectManualBidMode();
    fireEvent.click(screen.getByRole("button", { name: /increase bid/i }));
    selectAutoBidMode();
    selectManualBidMode();

    expect(screen.getAllByText(/£120\.00/i).length).toBeGreaterThan(0);
  });

  it("does not attach unsaved auto-bid draft to manual placeBid", async () => {
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

    renderArtworkBidPanel({
      auction: lot("other-seller"),
      initialHistory: [],
      sessionUser: buyerSession,
      summarySeed,
      initialAutoBidSettings: null,
      omitPricingHeader: true,
    });

    fireEvent.change(screen.getByLabelText(/max amount/i), { target: { value: "500" } });
    selectManualBidMode();
    fireEvent.click(screen.getByRole("button", { name: /review bid/i }));
    fireEvent.click(screen.getByRole("button", { name: /place bid/i }));

    await waitFor(() => expect(placeBidMock).toHaveBeenCalled());
    expect(placeBidMock.mock.calls[0]?.[0]).not.toHaveProperty("maxAutoBidAmount");
  });

  it("includes saved active auto-bid on manual placeBid", async () => {
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
        maxAutoBidAmount: "500",
        createdAt: new Date(),
      },
    });

    renderArtworkBidPanel({
      auction: lot("other-seller"),
      initialHistory: [],
      sessionUser: buyerSession,
      summarySeed,
      initialAutoBidSettings: {
        maxAutoBidAmount: "500",
        autoBidStepAmount: "10",
        isActive: true,
      },
      omitPricingHeader: true,
    });

    selectManualBidMode();
    fireEvent.click(screen.getByRole("button", { name: /review bid/i }));
    fireEvent.click(screen.getByRole("button", { name: /place bid/i }));

    await waitFor(() => expect(placeBidMock).toHaveBeenCalled());
    expect(placeBidMock.mock.calls[0]?.[0]).toMatchObject({
      maxAutoBidAmount: 500,
      autoBidStepAmount: 10,
    });
  });

  it("resets manual confirm step when switching modes", () => {
    renderArtworkBidPanel({
      auction: lot("other-seller"),
      initialHistory: [],
      sessionUser: buyerSession,
      summarySeed,
      initialAutoBidSettings: null,
      omitPricingHeader: true,
    });

    selectManualBidMode();
    fireEvent.click(screen.getByRole("button", { name: /review bid/i }));
    expect(screen.getByRole("button", { name: /place bid/i })).toBeInTheDocument();

    selectAutoBidMode();
    selectManualBidMode();
    expect(screen.getByRole("button", { name: /review bid/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /place bid/i })).not.toBeInTheDocument();
  });

  it("stays in manual mode after saving auto-bid when user chose manual", async () => {
    setAutoBidMock.mockResolvedValueOnce({
      ok: true,
      settings: {
        maxAutoBidAmount: "500",
        autoBidStepAmount: "10",
        isActive: true,
      },
      placedBid: {
        id: "bid-auto-1",
        amount: "110",
        placedByUserId: "buyer-1",
        maxAutoBidAmount: "500",
        autoBidStepAmount: "10",
      },
    });

    renderArtworkBidPanel({
      auction: lot("other-seller"),
      initialHistory: [],
      sessionUser: buyerSession,
      summarySeed,
      initialAutoBidSettings: null,
      omitPricingHeader: true,
    });

    selectManualBidMode();
    const autoPanel = document.getElementById("lot-auto-bid-panel");
    expect(autoPanel).not.toBeNull();
    const autoPanelQueries = within(autoPanel as HTMLElement);
    // Hidden panel is intentionally aria-hidden while manual mode is active.
    fireEvent.change(autoPanelQueries.getByLabelText(/max amount/i, { hidden: true } as never), {
      target: { value: "500" },
    });
    fireEvent.click(
      autoPanelQueries.getByRole("button", { name: /save auto-bid/i, hidden: true } as never),
    );

    await waitFor(() => expect(setAutoBidMock).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: /review bid/i })).toBeInTheDocument();
  });
});
