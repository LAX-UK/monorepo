import { useLotBidHydrateQuery } from "@/hooks/lot-bid/use-lot-bid-hydrate-query";
import {
  type LotBidHydrateData,
  buildLotBidInitialHydrate,
  lotBidKeys,
} from "@/lib/data/queries/lot-bid";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

const LOT_ID = "lot-1";

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function initialHydrate(): LotBidHydrateData {
  return buildLotBidInitialHydrate({
    lotId: LOT_ID,
    initialHistory: [],
    initialCurrentPrice: "100.00",
    initialLeadingBidderId: null,
  });
}

function patchedHydrate(): LotBidHydrateData {
  return {
    ...initialHydrate(),
    snapshot: {
      currentPrice: "500.00",
      endTime: new Date("2026-07-01T20:00:00Z"),
      status: "active",
      winnerId: null,
    },
    leadingBidderId: "bidder-a",
  };
}

/**
 * Regression guard: documents the same initialData + setQueryData limitation as saleroom.
 * LotBidHistoryProvider still reads useQuery().data — verify behavior before changing.
 */
describe("useLotBidHydrateQuery — cache updates", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetchLotBidSnapshot.mockReset();
    mockFetchLotBidHistory.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes setQueryData to the cache but not to useQuery().data when initialData is set", async () => {
    const queryClient = createTestQueryClient();
    const queryKey = lotBidKeys.hydrate(LOT_ID);
    const initial = initialHydrate();
    const patched = patchedHydrate();

    const { result } = renderHook(() => useLotBidHydrateQuery(LOT_ID, { initialData: initial }), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(result.current.data?.snapshot.currentPrice).toBe("100.00");

    await act(async () => {
      queryClient.setQueryData(queryKey, patched);
    });

    expect(queryClient.getQueryData(queryKey)).toEqual(patched);
    expect(result.current.data?.snapshot.currentPrice).toBe("100.00");
  });
});
