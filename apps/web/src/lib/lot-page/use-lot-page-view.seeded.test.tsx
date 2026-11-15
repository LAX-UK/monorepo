import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NO_LOT_VIEWER } from "./lot-viewer";
import { useLotPageView } from "./use-lot-page-view";

const NOW = Date.parse("2026-11-15T18:00:00.000Z");
const END = NOW + 20_000;

const online = vi.hoisted(() => ({ seededExtended: false }));

vi.mock("@/lib/context/online-lot-lifecycle", () => ({
  useOnlineLotLifecycle: () => ({
    liveLotStatus: "active",
    liveWinnerId: null,
    liveEndTimeMs: END,
    extendedByMs: null,
    extensionCount: 0,
    seededExtended: online.seededExtended,
  }),
}));
vi.mock("@/lib/context/lot-bid-history-provider", () => ({
  useLotBidHistory: () => ({
    live: true,
    snapshot: {
      currentPrice: "4000.00",
      endTime: new Date(END),
      status: "active",
      winnerId: null,
      serverNow: new Date(NOW).toISOString(),
    },
    currentPrice: "4000.00",
    entries: [],
    latestSnapshotReserveMet: undefined,
  }),
}));
vi.mock("@/lib/context/saleroom-live-provider", () => ({ useSaleroomLive: () => null }));
vi.mock("@/lib/lot-page/use-lot-page-now", () => ({ useLotPageNow: () => NOW }));
vi.mock("@/lib/lot-page/use-lot-reads", async () => ({
  useLotViewer: () => NO_LOT_VIEWER,
  useLotPublicHistory: () => null,
}));

const source = {
  lot: {
    id: "lot-1",
    auctionType: "english" as const,
    startingPrice: "1000.00",
    minBidIncrement: "100.00",
    marketingDetails: {},
    startTime: new Date(NOW - 86_400_000).toISOString(),
  },
  sale: { status: "active" as const, deliveryMode: "online" as const },
  signedIn: false,
  initialViewer: null,
};

describe("useLotPageView after a reload mid-extension", () => {
  beforeEach(() => {
    online.seededExtended = false;
  });

  it("a lot a late bid had extended reads as Extended on the first render", () => {
    online.seededExtended = true;
    const { result } = renderHook(() => useLotPageView(source as never));
    expect(result.current.view.lifecycle).toBe("extended");
  });

  it("the same lot without the seed reads as closing in its final seconds, not extended", () => {
    const { result } = renderHook(() => useLotPageView(source as never));
    expect(result.current.view.lifecycle).not.toBe("extended");
  });
});
