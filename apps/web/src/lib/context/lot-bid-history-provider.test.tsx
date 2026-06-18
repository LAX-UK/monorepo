import { LotBidHistoryProvider, useLotBidHistory } from "@/lib/context/lot-bid-history-provider";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFetchLotBidSnapshot = vi.fn();
const mockFetchLotBidHistory = vi.fn();

vi.mock("@/lib/bid/fetch-lot-bid-snapshot.client", () => ({
  fetchLotBidSnapshot: (...args: unknown[]) => mockFetchLotBidSnapshot(...args),
}));

vi.mock("@/lib/bid/fetch-lot-bid-history.client", () => ({
  fetchLotBidHistory: (...args: unknown[]) => mockFetchLotBidHistory(...args),
}));

vi.mock("@/hooks/use-lot-realtime", () => ({
  useLotRealtime: vi.fn(),
}));

vi.mock("@/lib/context/online-lot-lifecycle", () => ({
  useOnlineLotLifecycle: () => null,
}));

const mockNotifyWarning = vi.fn();
const mockNotifySuccess = vi.fn();
vi.mock("@/lib/ui/notify", () => ({
  notify: {
    warning: (...args: unknown[]) => mockNotifyWarning(...args),
    success: (...args: unknown[]) => mockNotifySuccess(...args),
  },
}));

const LOT_ID = "lot-1";
const RESYNC_INTERVAL_MS = 15_000;

const snapshot = {
  currentPrice: "500.00",
  endTime: new Date("2026-06-18T20:00:00Z"),
  status: "active" as const,
  winnerId: null,
};

const history = [
  {
    id: "bid-1",
    bidderId: "user-a",
    amount: "500.00",
    at: Date.now(),
  },
];

function wrapper({ children }: { children: ReactNode }) {
  return (
    <LotBidHistoryProvider
      lotId={LOT_ID}
      initialHistory={[]}
      initialCurrentPrice="100.00"
      initialLeadingBidderId={null}
    >
      {children}
    </LotBidHistoryProvider>
  );
}

async function advanceAndFlush(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("LotBidHistoryProvider resync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetchLotBidSnapshot.mockResolvedValue(snapshot);
    mockFetchLotBidHistory.mockResolvedValue(history);
    mockNotifyWarning.mockReset();
    mockNotifySuccess.mockReset();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("silently hydrates when the tab becomes visible", async () => {
    renderHook(() => useLotBidHistory(), { wrapper });
    await advanceAndFlush(100);

    mockFetchLotBidSnapshot.mockClear();
    mockFetchLotBidHistory.mockClear();

    await act(async () => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(mockFetchLotBidSnapshot).toHaveBeenCalledWith(LOT_ID);
    expect(mockFetchLotBidHistory).toHaveBeenCalledWith(LOT_ID);
    expect(mockNotifyWarning).not.toHaveBeenCalled();
  });

  it("does not hydrate on visibility change while the tab is hidden", async () => {
    renderHook(() => useLotBidHistory(), { wrapper });
    await advanceAndFlush(100);

    mockFetchLotBidSnapshot.mockClear();
    mockFetchLotBidHistory.mockClear();

    await act(async () => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(mockFetchLotBidSnapshot).not.toHaveBeenCalled();
    expect(mockFetchLotBidHistory).not.toHaveBeenCalled();
  });

  it("silently hydrates on the periodic interval", async () => {
    renderHook(() => useLotBidHistory(), { wrapper });
    await advanceAndFlush(100);

    mockFetchLotBidSnapshot.mockClear();
    mockFetchLotBidHistory.mockClear();

    await advanceAndFlush(RESYNC_INTERVAL_MS);

    expect(mockFetchLotBidSnapshot).toHaveBeenCalledWith(LOT_ID);
    expect(mockFetchLotBidHistory).toHaveBeenCalledWith(LOT_ID);
    expect(mockNotifyWarning).not.toHaveBeenCalled();
  });

  it("stops interval polling once the lot has ended", async () => {
    const { result } = renderHook(() => useLotBidHistory(), { wrapper });
    await advanceAndFlush(100);

    await act(async () => {
      await result.current.refreshFromServer({ silent: true });
    });

    mockFetchLotBidSnapshot.mockResolvedValue({
      ...snapshot,
      status: "ended",
      winnerId: "user-a",
    });

    await act(async () => {
      await result.current.refreshFromServer({ silent: true });
    });

    mockFetchLotBidSnapshot.mockClear();
    mockFetchLotBidHistory.mockClear();

    await advanceAndFlush(RESYNC_INTERVAL_MS);

    expect(mockFetchLotBidSnapshot).not.toHaveBeenCalled();
    expect(mockFetchLotBidHistory).not.toHaveBeenCalled();
  });
});
