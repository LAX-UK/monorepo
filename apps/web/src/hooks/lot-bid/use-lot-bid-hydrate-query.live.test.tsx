import { useLotBidHydrateQuery } from "@/hooks/lot-bid/use-lot-bid-hydrate-query";
import { isLiveLotBidHydrate, pendingLotBidHydrate } from "@/lib/data/queries/lot-bid";
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
 * CO-7: the lot page HTML is built from cached reads and carries no bid state. The panel starts
 * from a placeholder and reads the live snapshot as soon as it mounts.
 */
describe("useLotBidHydrateQuery from the placeholder", () => {
  it("starts pending and becomes live once the live read lands", async () => {
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
    const { result } = renderHook(
      () => useLotBidHydrateQuery("lot-1", { initialData: pendingLotBidHydrate() }),
      { wrapper },
    );

    expect(result.current.data && isLiveLotBidHydrate(result.current.data)).toBe(false);
    await waitFor(() => expect(result.current.data?.snapshot.currentPrice).toBe("750.00"));
    expect(result.current.data && isLiveLotBidHydrate(result.current.data)).toBe(true);
    expect(mockFetchLotBidSnapshot).toHaveBeenCalledWith("lot-1");
    client.clear();
  });

  it("the placeholder holds no bid state", () => {
    const pending = pendingLotBidHydrate();
    expect(pending.entries).toEqual([]);
    expect(pending.leadingBidderId).toBeNull();
    expect(pending.snapshot.winnerId).toBeNull();
    expect(isLiveLotBidHydrate(pending)).toBe(false);
  });
});
