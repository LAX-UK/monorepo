import { LotBidHistoryProvider, useLotBidHistory } from "@/lib/context/lot-bid-history-provider";
import {
  OnlineLotLifecycleProvider,
  useOnlineLotLifecycle,
} from "@/lib/context/online-lot-lifecycle";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const NOW = Date.parse("2026-11-01T12:00:00Z");
const HOUR = 60 * 60 * 1000;

/** The catalogue lot the page hands over: its bid fields are neutral placeholders. */
const catalogueLot = {
  id: "lot-1",
  status: "scheduled" as const,
  startTime: new Date(NOW - HOUR),
  endTime: new Date(NOW - HOUR),
  winnerId: null,
  currentPrice: "100.00",
};

function renderLive() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <OnlineLotLifecycleProvider lot={catalogueLot} sale={null}>
          <LotBidHistoryProvider lotId="lot-1">{children}</LotBidHistoryProvider>
        </OnlineLotLifecycleProvider>
      </QueryClientProvider>
    );
  }
  return renderHook(() => ({ lifecycle: useOnlineLotLifecycle(), bids: useLotBidHistory() }), {
    wrapper: Wrapper,
  });
}

describe("LotBidHistoryProvider takes the lot's state only from the live read (CO-7)", () => {
  beforeEach(() => {
    mockFetchLotBidSnapshot.mockReset();
    mockFetchLotBidHistory.mockReset();
  });

  it("applies nothing until the live read lands", () => {
    // A read that never answers: the page stays on its placeholder.
    mockFetchLotBidSnapshot.mockReturnValue(new Promise(() => {}));
    mockFetchLotBidHistory.mockReturnValue(new Promise(() => {}));
    const { result } = renderLive();
    expect(result.current.bids.live).toBe(false);
    expect(result.current.bids.entries).toEqual([]);
    expect(result.current.bids.leadingBidderId).toBeNull();
    expect(result.current.lifecycle?.liveLotStatus).toBeNull();
    expect(result.current.lifecycle?.liveEndTimeMs).toBeNull();
  });

  it("stays pending when the live read fails", async () => {
    mockFetchLotBidSnapshot.mockResolvedValue(null);
    mockFetchLotBidHistory.mockResolvedValue(null);
    const { result } = renderLive();
    await waitFor(() => expect(mockFetchLotBidSnapshot).toHaveBeenCalled());
    expect(result.current.bids.live).toBe(false);
    expect(result.current.lifecycle?.liveLotStatus).toBeNull();
  });

  it("takes status, close and winner from the live read, and the first close is no extension", async () => {
    const endTime = new Date(NOW + 48 * HOUR);
    mockFetchLotBidSnapshot.mockResolvedValue({
      currentPrice: "4000.00",
      endTime,
      status: "active",
      winnerId: null,
    });
    mockFetchLotBidHistory.mockResolvedValue([
      { id: "b1", bidderId: "leader-1", amount: "4000.00", at: NOW },
    ]);
    const { result } = renderLive();
    await waitFor(() => expect(result.current.bids.live).toBe(true));
    expect(result.current.bids.currentPrice).toBe("4000.00");
    expect(result.current.bids.leadingBidderId).toBe("leader-1");
    expect(result.current.lifecycle?.liveLotStatus).toBe("active");
    expect(result.current.lifecycle?.liveEndTimeMs).toBe(endTime.getTime());
    expect(result.current.lifecycle?.extensionCount).toBe(0);
  });

  it("carries an ended lot's winner from the live read", async () => {
    mockFetchLotBidSnapshot.mockResolvedValue({
      currentPrice: "95000.00",
      endTime: new Date(NOW - HOUR),
      status: "ended",
      winnerId: "buyer-1",
    });
    mockFetchLotBidHistory.mockResolvedValue([]);
    const { result } = renderLive();
    await waitFor(() => expect(result.current.lifecycle?.liveLotStatus).toBe("ended"));
    expect(result.current.lifecycle?.liveWinnerId).toBe("buyer-1");
  });
});
