import { useSaleroomStatusQuery } from "@/hooks/saleroom/use-saleroom-status-query";
import { saleroomKeys } from "@/lib/data/queries/saleroom";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFetchSaleroomStatus = vi.fn();
vi.mock("@/lib/data/http/saleroom-status.client", () => ({
  fetchSaleroomStatus: (...args: unknown[]) => mockFetchSaleroomStatus(...args),
}));

const INITIAL_NONE: PublicSaleroomSessionStatus = { status: "none", currentLotId: null };
const LIVE_LOT1: PublicSaleroomSessionStatus = { status: "live", currentLotId: "lot-1" };

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

/**
 * Regression guard: with initialData, setQueryData updates the cache but does not
 * propagate to useQuery().data — SaleroomLiveProvider reads the cache via useSyncExternalStore instead.
 */
describe("useSaleroomStatusQuery — cache updates", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetchSaleroomStatus.mockReset();
    mockFetchSaleroomStatus.mockResolvedValue(INITIAL_NONE);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes setQueryData to the cache but not to useQuery().data when initialData is set", async () => {
    const queryClient = createTestQueryClient();
    const saleId = "sale-1";
    const queryKey = saleroomKeys.status(saleId);

    const { result } = renderHook(
      () => useSaleroomStatusQuery(saleId, { initialData: INITIAL_NONE }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(result.current.data?.currentLotId).toBeNull();

    await act(async () => {
      queryClient.setQueryData(queryKey, LIVE_LOT1);
    });

    expect(queryClient.getQueryData(queryKey)).toEqual(LIVE_LOT1);
    expect(result.current.data).toEqual(INITIAL_NONE);
  });
});
