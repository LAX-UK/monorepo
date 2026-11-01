import { LotBidHistoryProvider } from "@/lib/context/lot-bid-history-provider";
import {
  OnlineLotLifecycleProvider,
  useOnlineLotLifecycle,
} from "@/lib/context/online-lot-lifecycle";
import { classifyLotLifecycle } from "@/lib/lot/lot-lifecycle";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/bid/fetch-lot-bid-snapshot.client", () => ({
  fetchLotBidSnapshot: vi.fn(async () => null),
}));

vi.mock("@/lib/bid/fetch-lot-bid-history.client", () => ({
  fetchLotBidHistory: vi.fn(async () => null),
}));

vi.mock("@/hooks/use-lot-realtime", () => ({
  useLotRealtime: vi.fn(),
}));

const NOW = Date.parse("2026-11-01T12:00:00Z");
const HOUR = 60 * 60 * 1000;

type LotFixture = {
  id: string;
  status: "active" | "scheduled" | "ended";
  startTime: Date;
  endTime: Date;
  winnerId: string | null;
  currentPrice: string;
};

function renderLifecycle(lot: LotFixture) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <OnlineLotLifecycleProvider lot={lot} sale={null}>
          <LotBidHistoryProvider
            lotId={lot.id}
            initialHistory={[]}
            initialSnapshot={{
              currentPrice: lot.currentPrice,
              endTime: lot.endTime,
              status: lot.status,
              winnerId: lot.winnerId,
            }}
            initialLeadingBidderId={lot.winnerId}
          >
            {children}
          </LotBidHistoryProvider>
        </OnlineLotLifecycleProvider>
      </QueryClientProvider>
    );
  }
  return renderHook(() => useOnlineLotLifecycle(), { wrapper: Wrapper });
}

describe("LotBidHistoryProvider seeds the lot lifecycle from the server lot", () => {
  it("keeps a live lot open for a signed-out visitor before any resync", () => {
    const lot: LotFixture = {
      id: "lot-live",
      status: "active",
      startTime: new Date(NOW - HOUR),
      endTime: new Date(NOW + 48 * HOUR),
      winnerId: "leader-1",
      currentPrice: "4000.00",
    };
    const { result } = renderLifecycle(lot);

    expect(result.current?.liveEndTimeMs).toBe(lot.endTime.getTime());
    expect(result.current?.liveLotStatus).toBe("active");

    const lifecycle = classifyLotLifecycle(
      { ...lot, endTime: new Date(result.current?.liveEndTimeMs ?? 0) },
      null,
      NOW,
    );
    expect(lifecycle.kind).toBe("live");
  });

  it("carries an ended lot's winner, so a sold lot never reads as no sale", () => {
    const { result } = renderLifecycle({
      id: "lot-sold",
      status: "ended",
      startTime: new Date(NOW - 48 * HOUR),
      endTime: new Date(NOW - HOUR),
      winnerId: "buyer-1",
      currentPrice: "95000.00",
    });
    expect(result.current?.liveLotStatus).toBe("ended");
    expect(result.current?.liveWinnerId).toBe("buyer-1");
  });

  it("keeps an upcoming lot scheduled instead of marking it active", () => {
    const lot: LotFixture = {
      id: "lot-upcoming",
      status: "scheduled",
      startTime: new Date(NOW + 9 * 24 * HOUR),
      endTime: new Date(NOW + 10 * 24 * HOUR),
      winnerId: null,
      currentPrice: "0.00",
    };
    const { result } = renderLifecycle(lot);

    expect(result.current?.liveLotStatus).toBe("scheduled");
    expect(result.current?.liveEndTimeMs).toBe(lot.endTime.getTime());
  });
});
