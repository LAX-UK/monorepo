import { type UsePlaceBidParams, usePlaceBid } from "@/hooks/lot-bid/use-place-bid";
import type { LotBidPosition } from "@/lib/bid/derive-lot-bid-position";
import type { AutoBidSettings, BidWriter } from "@/lib/data/contracts";
import type { LotLifecycle } from "@/lib/lot/lot-lifecycle";
import { BID_ERROR_CODES } from "@/lib/ui/bid-error/codes";
import type { Lot } from "@auction/types";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const EXPECTED_RETURN_KEYS = [
  "activeAutoBidNote",
  "amount",
  "autoBidEligible",
  "autoBidExplainerText",
  "bidStepNumeric",
  "bidSuccess",
  "clearConfirmAttempt",
  "connectionBlocked",
  "displayedFeedback",
  "englishOnlySurfaceLock",
  "entryMode",
  "feedbackError",
  "handleAutoBidDraft",
  "handleFeedbackAction",
  "includeAutoBidOnManualBid",
  "isWinning",
  "loginNext",
  "manualBidBlockedReason",
  "maxAuto",
  "minNumeric",
  "onAutoBidSaved",
  "onConfirm",
  "onReview",
  "onUseMinimum",
  "setAmount",
  "setFeedbackError",
  "setMaxAuto",
  "setStep",
  "showAutoBidExplainer",
  "step",
  "submitting",
  "supportsAutoBid",
  "switchEntryMode",
  "useOnlineBidStepper",
] as const;

const baseLot = (): Lot => ({
  id: "lot-x",
  saleId: "sale-1",
  lotNumber: 1,
  sellerId: "seller-1",
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
  dutchDecrementIntervalMs: 60_000,
  dutchLastDecrementAt: null,
  startTime: new Date(),
  endTime: new Date(Date.now() + 86_400_000),
  status: "active",
  winnerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  marketingDetails: {},
});

const liveLifecycle: LotLifecycle = { kind: "live", msLeft: 60_000 };

const notBiddingPosition: LotBidPosition = { kind: "notBidding" };

const outbidPosition: LotBidPosition = {
  kind: "outbid",
  autoBid: { max: "500", step: "10" },
};

function createParams(overrides: Partial<UsePlaceBidParams> = {}): UsePlaceBidParams {
  const placeBid = vi.fn();
  const bidWriter = { placeBid } as unknown as BidWriter;
  return {
    auction: baseLot(),
    sessionUser: { id: "buyer-1", email: "b@b.co", name: "Buyer", role: "client" },
    initialAutoBidSettings: null,
    initialOutbid: false,
    omitPricingHeader: true,
    currentPrice: "100",
    leadingBidderId: null,
    activeAutoBid: null,
    position: notBiddingPosition,
    lifecycle: liveLifecycle,
    countdownClock: "",
    biddingLive: false,
    isLotOnBlock: false,
    biddingAllowed: true,
    realtimeHealthy: true,
    applyOwnBidResult: vi.fn(),
    scrollToBid: vi.fn(),
    scrollToAutoBid: vi.fn(),
    handleAutoBidSaved: vi.fn(),
    markLotEndedLocally: vi.fn(),
    setActiveAutoBid: vi.fn(),
    bidWriter,
    refreshFromServer: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  };
}

describe("usePlaceBid characterization", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", {
      randomUUID: () => "test-idempotency-key",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exposes a stable return-shape key set", () => {
    const { result } = renderHook(() => usePlaceBid(createParams()));
    expect([...Object.keys(result.current)].sort()).toEqual([...EXPECTED_RETURN_KEYS].sort());
  });

  it("reuses the same idempotency key across confirm retries for bid_in_flight", async () => {
    const placeBid = vi
      .fn()
      .mockResolvedValue({ ok: false, error: "Bid still processing", code: "bid_in_flight" });
    const bidWriter = { placeBid } as unknown as BidWriter;
    const { result } = renderHook(() => usePlaceBid(createParams({ bidWriter })));

    act(() => {
      result.current.setAmount("110");
      result.current.onReview();
    });
    expect(result.current.step).toBe(2);

    await act(async () => {
      await result.current.onConfirm();
    });
    await act(async () => {
      await result.current.onConfirm();
    });

    expect(placeBid).toHaveBeenCalledTimes(2);
    const keys = placeBid.mock.calls.map((call) => call[0]?.idempotencyKey);
    expect(keys.every((key) => key === "test-idempotency-key")).toBe(true);
    expect(result.current.step).toBe(2);
  });

  it("resets confirm step on sale_registration_required errors", async () => {
    const placeBid = vi.fn().mockResolvedValue({
      ok: false,
      error: "Register for this sale",
      code: "sale_registration_required",
    });
    const bidWriter = { placeBid } as unknown as BidWriter;
    const { result } = renderHook(() => usePlaceBid(createParams({ bidWriter })));

    act(() => {
      result.current.setAmount("110");
      result.current.onReview();
    });
    await act(async () => {
      await result.current.onConfirm();
    });

    expect(result.current.step).toBe(1);
  });

  it("switches to auto mode when confirm receives already_leading", async () => {
    const placeBid = vi.fn().mockResolvedValue({
      ok: false,
      error: "already the highest bidder",
      code: BID_ERROR_CODES.already_leading,
    });
    const bidWriter = { placeBid } as unknown as BidWriter;
    const { result } = renderHook(() => usePlaceBid(createParams({ bidWriter })));

    act(() => {
      result.current.switchEntryMode("manual", { userInitiated: true });
      result.current.setAmount("110");
      result.current.onReview();
    });
    await act(async () => {
      await result.current.onConfirm();
    });

    expect(result.current.entryMode).toBe("auto");
  });

  it("blocks confirm when live bidding is unhealthy until refresh succeeds", async () => {
    const refreshFromServer = vi.fn().mockResolvedValue({ ok: false });
    const placeBid = vi.fn();
    const bidWriter = { placeBid } as unknown as BidWriter;
    const { result } = renderHook(() =>
      usePlaceBid(
        createParams({
          bidWriter,
          refreshFromServer,
          biddingLive: true,
          biddingAllowed: true,
          realtimeHealthy: false,
        }),
      ),
    );

    act(() => {
      result.current.setAmount("110");
      result.current.onReview();
    });
    await act(async () => {
      await result.current.onConfirm();
    });

    expect(refreshFromServer).toHaveBeenCalled();
    expect(placeBid).not.toHaveBeenCalled();
    expect(result.current.feedbackError?.message).toMatch(/could not refresh live prices/i);
  });

  it("calls markLotEndedLocally for dutch lots after a winning bid", async () => {
    const markLotEndedLocally = vi.fn();
    const placeBid = vi.fn().mockResolvedValue({
      ok: true,
      bid: {
        id: "bid-1",
        lotId: "lot-x",
        amount: "110",
        isWinning: true,
        isAutoBid: false,
        maxAutoBidAmount: null,
        createdAt: new Date(),
      },
    });
    const bidWriter = { placeBid } as unknown as BidWriter;
    const dutchLot = { ...baseLot(), auctionType: "dutch" as const };
    const { result } = renderHook(() =>
      usePlaceBid(
        createParams({
          auction: dutchLot,
          bidWriter,
          markLotEndedLocally,
        }),
      ),
    );

    act(() => {
      result.current.setAmount("110");
      result.current.onReview();
    });
    await act(async () => {
      await result.current.onConfirm();
    });

    expect(markLotEndedLocally).toHaveBeenCalledWith("Sale complete — this Dutch lot has closed.");
  });

  it("calls markLotEndedLocally when buy-now threshold is met", async () => {
    const markLotEndedLocally = vi.fn();
    const placeBid = vi.fn().mockResolvedValue({
      ok: true,
      bid: {
        id: "bid-1",
        lotId: "lot-x",
        amount: "500",
        isWinning: true,
        isAutoBid: false,
        maxAutoBidAmount: null,
        createdAt: new Date(),
      },
    });
    const bidWriter = { placeBid } as unknown as BidWriter;
    const buyNowLot = {
      ...baseLot(),
      auctionType: "buy_it_now" as const,
      buyNowPrice: "500",
    };
    const { result } = renderHook(() =>
      usePlaceBid(
        createParams({
          auction: buyNowLot,
          bidWriter,
          markLotEndedLocally,
        }),
      ),
    );

    act(() => {
      result.current.setAmount("500");
      result.current.onReview();
    });
    await act(async () => {
      await result.current.onConfirm();
    });

    expect(markLotEndedLocally).toHaveBeenCalledWith(
      "Buy now — this lot has sold at the buy-now price.",
    );
  });

  it("auto-selects auto mode when outbid with active auto-bid settings", () => {
    const activeAutoBid: AutoBidSettings = {
      maxAutoBidAmount: "500",
      autoBidStepAmount: "10",
      isActive: true,
    };
    const { result } = renderHook(() =>
      usePlaceBid(
        createParams({
          initialOutbid: true,
          activeAutoBid,
          position: outbidPosition,
        }),
      ),
    );

    expect(result.current.entryMode).toBe("auto");
  });

  it("clears bidSuccess after 4000ms", () => {
    vi.useFakeTimers();
    const placeBid = vi.fn().mockResolvedValue({
      ok: true,
      bid: {
        id: "bid-1",
        lotId: "lot-x",
        amount: "110",
        isWinning: true,
        isAutoBid: false,
        maxAutoBidAmount: null,
        createdAt: new Date(),
      },
    });
    const bidWriter = { placeBid } as unknown as BidWriter;
    const { result } = renderHook(() => usePlaceBid(createParams({ bidWriter })));

    act(() => {
      result.current.setAmount("110");
      result.current.onReview();
    });
    act(() => {
      void result.current.onConfirm();
    });

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(result.current.bidSuccess).toBe(false);
    vi.useRealTimers();
  });
});
