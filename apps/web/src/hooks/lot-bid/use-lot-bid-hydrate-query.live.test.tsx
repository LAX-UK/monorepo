import { useLotBidHydrateQuery } from "@/hooks/lot-bid/use-lot-bid-hydrate-query";
import { buildLotBidInitialHydrate } from "@/lib/data/queries/lot-bid";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const mockFetchLotBidSnapshot = vi.fn();
const mockFetchLotBidHistory = vi.fn();

vi.mock("@/lib/bid/fetch-lot-bid-snapshot.client", () => ({
  fetchLotBidSnapshot: (...args: unknown[]) => mockFetchLotBidSnapshot(...args),
}));
vi.mock("@/lib/bid/fetch-lot-bid-history.client", () => ({
  fetchLotBidHistory: (...args: unknown[]) => mockFetchLotBidHistory(...args),
}));

/**
 * CO-7: the lot page HTML may come from a cache. Its bid snapshot is a first paint only; the live
 * price and status are read again as soon as the panel mounts, never trusted from the cache.
 */
describe("useLotBidHydrateQuery with a cached page", () => {
  it("reads the live snapshot on mount and replaces the cached price", async () => {
    const cached = buildLotBidInitialHydrate({
      initialSnapshot: {
        currentPrice: "100.00",
        endTime: new Date("2026-07-01T20:00:00Z"),
        status: "active",
        winnerId: null,
      },
      initialHistory: [],
      initialLeadingBidderId: null,
    });
    mockFetchLotBidSnapshot.mockResolvedValue({
      currentPrice: "750.00",
      endTime: new Date("2026-07-01T20:02:00Z"),
      status: "active",
      winnerId: null,
    });
    mockFetchLotBidHistory.mockResolvedValue([]);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useLotBidHydrateQuery("lot-1", { initialData: cached }), {
      wrapper,
    });

    expect(result.current.data?.snapshot.currentPrice).toBe("100.00");
    await waitFor(() => expect(result.current.data?.snapshot.currentPrice).toBe("750.00"));
    expect(mockFetchLotBidSnapshot).toHaveBeenCalledWith("lot-1");
    client.clear();
  });
});
