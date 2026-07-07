import { SaleroomLiveProvider, useSaleroomLive } from "@/lib/context/saleroom-live-provider";
import { saleroomKeys } from "@/lib/data/queries/saleroom";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockEmit = vi.fn();
const mockOn = vi.fn();
const mockOff = vi.fn();
const mockConnected = { value: false };

vi.mock("@/lib/socket", () => ({
  getSocket: () => ({
    emit: mockEmit,
    on: mockOn,
    off: mockOff,
    get connected() {
      return mockConnected.value;
    },
  }),
}));

const mockFetchSaleroomStatus = vi.fn();
vi.mock("@/lib/data/http/saleroom-status.client", () => ({
  fetchSaleroomStatus: (...args: unknown[]) => mockFetchSaleroomStatus(...args),
}));

const mockReportNotice = vi.fn();
const mockClearNotice = vi.fn();
vi.mock("@/lib/connection/live-connectivity-notice", () => ({
  useLiveConnectivityNoticeReporterOptional: () => ({
    reportNotice: (...args: unknown[]) => mockReportNotice(...args),
    clearNotice: (...args: unknown[]) => mockClearNotice(...args),
  }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const INITIAL_NONE: PublicSaleroomSessionStatus = {
  status: "none",
  currentLotId: null,
  nextLotId: null,
};
const LIVE_LOT1: PublicSaleroomSessionStatus = {
  status: "live",
  currentLotId: "lot-1",
  nextLotId: null,
};
const LIVE_NO_LOT: PublicSaleroomSessionStatus = {
  status: "live",
  currentLotId: null,
  nextLotId: null,
};

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function wrapper(saleId: string, initial: PublicSaleroomSessionStatus) {
  const queryClient = createTestQueryClient();
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <SaleroomLiveProvider saleId={saleId} initial={initial}>
        {children}
      </SaleroomLiveProvider>
    </QueryClientProvider>
  );
}

function wrapperWithClient(saleId: string, initial: PublicSaleroomSessionStatus) {
  const queryClient = createTestQueryClient();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <SaleroomLiveProvider saleId={saleId} initial={initial}>
        {children}
      </SaleroomLiveProvider>
    </QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

/** Trigger the joinSaleroom ack (third arg to socket.emit). */
function triggerJoinAck() {
  const joinCall = mockEmit.mock.calls.find((c) => c[0] === "joinSaleroom");
  const ack = joinCall?.[2];
  if (typeof ack === "function") ack();
}

/** Trigger a "saleroomEvent" handler registered via socket.on. */
function triggerSaleroomEvent(payload: unknown) {
  for (const [event, handler] of mockOn.mock.calls) {
    if (event === "saleroomEvent" && typeof handler === "function") {
      handler(payload);
    }
  }
}

/**
 * Advance time by `ms` and flush any pending microtasks/promises.
 * Safe with setInterval because it doesn't drain all timers infinitely.
 */
async function advanceAndFlush(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  mockEmit.mockReset();
  mockOn.mockReset();
  mockOff.mockReset();
  mockReportNotice.mockReset();
  mockClearNotice.mockReset();
  mockFetchSaleroomStatus.mockReset();
  mockConnected.value = false;
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("SaleroomLiveProvider — join-ack hydrate", () => {
  it("re-hydrates from the server after the joinSaleroom ack", async () => {
    mockFetchSaleroomStatus.mockResolvedValue(LIVE_NO_LOT);

    const { result } = renderHook(() => useSaleroomLive(), {
      wrapper: wrapper("sale-1", INITIAL_NONE),
    });

    // Flush initial mount hydrate (advance a little to settle promises)
    await advanceAndFlush(100);
    expect(result.current?.currentLotId).toBeNull();

    // Now server has advanced the lot
    mockFetchSaleroomStatus.mockResolvedValue(LIVE_LOT1);

    // Trigger the join ack
    await act(async () => {
      triggerJoinAck();
    });
    await advanceAndFlush(100);

    expect(mockFetchSaleroomStatus).toHaveBeenCalledWith("sale-1");
    expect(result.current?.currentLotId).toBe("lot-1");
  });

  it("marks state as authoritative after join-ack hydrate", async () => {
    mockFetchSaleroomStatus.mockResolvedValue(LIVE_LOT1);

    const { result } = renderHook(() => useSaleroomLive(), {
      wrapper: wrapper("sale-1", INITIAL_NONE),
    });

    await advanceAndFlush(100);

    expect(result.current?.currentLotId).toBe("lot-1");
    expect(result.current?.status).toBe("live");
  });
});

describe("SaleroomLiveProvider — periodic interval resync", () => {
  it("re-hydrates after the resync interval fires", async () => {
    mockFetchSaleroomStatus.mockResolvedValue(LIVE_NO_LOT);

    const { result } = renderHook(() => useSaleroomLive(), {
      wrapper: wrapper("sale-1", INITIAL_NONE),
    });

    await advanceAndFlush(100);
    expect(result.current?.currentLotId).toBeNull();

    // Lot is now on the block — interval fires
    mockFetchSaleroomStatus.mockResolvedValue(LIVE_LOT1);
    await advanceAndFlush(15_000);

    expect(result.current?.currentLotId).toBe("lot-1");
    expect(result.current?.isLotOnBlock("lot-1")).toBe(true);
  });

  it("does NOT show a warning toast when the periodic hydrate fails", async () => {
    mockFetchSaleroomStatus.mockResolvedValue(LIVE_LOT1);

    renderHook(() => useSaleroomLive(), {
      wrapper: wrapper("sale-1", INITIAL_NONE),
    });

    await advanceAndFlush(100);

    mockFetchSaleroomStatus.mockResolvedValue(null);
    mockReportNotice.mockClear();

    await advanceAndFlush(15_000);

    expect(mockReportNotice).not.toHaveBeenCalled();
  });

  it("de-dupes overlapping interval hydrates via in-flight guard", async () => {
    // Mount and settle
    mockFetchSaleroomStatus.mockResolvedValue(LIVE_LOT1);
    renderHook(() => useSaleroomLive(), { wrapper: wrapper("sale-1", INITIAL_NONE) });
    await advanceAndFlush(100);

    const callsAfterMount = mockFetchSaleroomStatus.mock.calls.length;

    // Hold the next fetch in-flight
    let resolveHeld!: (v: PublicSaleroomSessionStatus) => void;
    mockFetchSaleroomStatus.mockImplementation(
      () =>
        new Promise<PublicSaleroomSessionStatus>((r) => {
          resolveHeld = r;
        }),
    );

    // Advance one interval — fetch is in-flight
    await vi.advanceTimersByTimeAsync(15_000);

    // Advance a second interval — the in-flight guard should block this
    await vi.advanceTimersByTimeAsync(15_000);

    // Resolve the first held fetch
    await act(async () => {
      resolveHeld(LIVE_LOT1);
      await vi.advanceTimersByTimeAsync(100);
    });

    // Only 1 extra call should have been made despite two interval ticks
    expect(mockFetchSaleroomStatus.mock.calls.length).toBe(callsAfterMount + 1);
  });

  it("clears the interval on unmount (no hydrates after teardown)", async () => {
    mockFetchSaleroomStatus.mockResolvedValue(LIVE_LOT1);

    const { unmount } = renderHook(() => useSaleroomLive(), {
      wrapper: wrapper("sale-1", INITIAL_NONE),
    });

    await advanceAndFlush(100);
    const callsBefore = mockFetchSaleroomStatus.mock.calls.length;

    unmount();

    await advanceAndFlush(60_000);

    expect(mockFetchSaleroomStatus.mock.calls.length).toBe(callsBefore);
  });
});

describe("SaleroomLiveProvider — visibility resync", () => {
  it("re-hydrates silently when the tab becomes visible", async () => {
    mockFetchSaleroomStatus.mockResolvedValue(LIVE_NO_LOT);

    const { result } = renderHook(() => useSaleroomLive(), {
      wrapper: wrapper("sale-1", INITIAL_NONE),
    });

    await advanceAndFlush(100);
    expect(result.current?.currentLotId).toBeNull();

    mockFetchSaleroomStatus.mockResolvedValue(LIVE_LOT1);

    await act(async () => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(result.current?.currentLotId).toBe("lot-1");
    expect(result.current?.isLotOnBlock("lot-1")).toBe(true);
  });

  it("does NOT re-hydrate when the tab becomes hidden", async () => {
    mockFetchSaleroomStatus.mockResolvedValue(LIVE_LOT1);

    renderHook(() => useSaleroomLive(), { wrapper: wrapper("sale-1", INITIAL_NONE) });

    await advanceAndFlush(100);
    const callsBefore = mockFetchSaleroomStatus.mock.calls.length;

    await act(async () => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(mockFetchSaleroomStatus.mock.calls.length).toBe(callsBefore);
  });

  it("removes the visibilitychange listener on unmount", async () => {
    mockFetchSaleroomStatus.mockResolvedValue(LIVE_LOT1);

    const { unmount } = renderHook(() => useSaleroomLive(), {
      wrapper: wrapper("sale-1", INITIAL_NONE),
    });

    await advanceAndFlush(100);
    unmount();

    const callsBefore = mockFetchSaleroomStatus.mock.calls.length;

    await act(async () => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(mockFetchSaleroomStatus.mock.calls.length).toBe(callsBefore);
  });
});

describe("SaleroomLiveProvider — refresh()", () => {
  it("triggers a silent hydrate and updates currentLotId", async () => {
    mockFetchSaleroomStatus.mockResolvedValue(LIVE_NO_LOT);

    const { result } = renderHook(() => useSaleroomLive(), {
      wrapper: wrapper("sale-1", INITIAL_NONE),
    });

    await advanceAndFlush(100);
    expect(result.current?.currentLotId).toBeNull();

    mockFetchSaleroomStatus.mockResolvedValue(LIVE_LOT1);

    await act(async () => {
      result.current?.refresh();
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(result.current?.currentLotId).toBe("lot-1");
    expect(result.current?.isLotOnBlock("lot-1")).toBe(true);
  });

  it("does not show a toast when refresh() fetch fails", async () => {
    mockFetchSaleroomStatus.mockResolvedValue(LIVE_LOT1);

    const { result } = renderHook(() => useSaleroomLive(), {
      wrapper: wrapper("sale-1", INITIAL_NONE),
    });

    await advanceAndFlush(100);

    mockFetchSaleroomStatus.mockResolvedValue(null);
    mockReportNotice.mockClear();

    await act(async () => {
      result.current?.refresh();
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(mockReportNotice).not.toHaveBeenCalled();
  });

  it("de-dupes concurrent refresh() calls via in-flight guard", async () => {
    mockFetchSaleroomStatus.mockResolvedValue(LIVE_LOT1);

    const { result } = renderHook(() => useSaleroomLive(), {
      wrapper: wrapper("sale-1", INITIAL_NONE),
    });

    await advanceAndFlush(100);
    const callsBefore = mockFetchSaleroomStatus.mock.calls.length;

    let resolveFirst!: (v: PublicSaleroomSessionStatus) => void;
    mockFetchSaleroomStatus.mockImplementation(
      () =>
        new Promise<PublicSaleroomSessionStatus>((r) => {
          resolveFirst = r;
        }),
    );

    await act(async () => {
      result.current?.refresh(); // starts in-flight
      result.current?.refresh(); // should be blocked
      resolveFirst(LIVE_LOT1);
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(mockFetchSaleroomStatus.mock.calls.length).toBe(callsBefore + 1);
  });
});

describe("SaleroomLiveProvider — socket event passthrough", () => {
  it("updates state when a saleroomEvent arrives", async () => {
    mockFetchSaleroomStatus.mockResolvedValue(INITIAL_NONE);

    const { result } = renderHook(() => useSaleroomLive(), {
      wrapper: wrapper("sale-1", INITIAL_NONE),
    });

    await advanceAndFlush(100);

    await act(async () => {
      triggerSaleroomEvent({ kind: "advanced_to_lot", saleId: "sale-1", lotId: "lot-1" });
    });

    expect(result.current?.currentLotId).toBe("lot-1");
    expect(result.current?.isLotOnBlock("lot-1")).toBe(true);
  });

  it("writes socket events to the TanStack Query cache (single source of truth)", async () => {
    mockFetchSaleroomStatus.mockResolvedValue(INITIAL_NONE);

    const { queryClient, Wrapper } = wrapperWithClient("sale-1", INITIAL_NONE);

    renderHook(() => useSaleroomLive(), { wrapper: Wrapper });

    await advanceAndFlush(100);

    await act(async () => {
      triggerSaleroomEvent({ kind: "advanced_to_lot", saleId: "sale-1", lotId: "lot-1" });
    });

    expect(queryClient.getQueryData(saleroomKeys.status("sale-1"))).toEqual(LIVE_LOT1);
  });

  it("ignores saleroomEvent for a different saleId", async () => {
    mockFetchSaleroomStatus.mockResolvedValue(INITIAL_NONE);

    const { result } = renderHook(() => useSaleroomLive(), {
      wrapper: wrapper("sale-1", INITIAL_NONE),
    });

    await advanceAndFlush(100);

    await act(async () => {
      triggerSaleroomEvent({ kind: "advanced_to_lot", saleId: "OTHER-SALE", lotId: "lot-1" });
    });

    expect(result.current?.currentLotId).toBeNull();
  });
});

describe("SaleroomLiveProvider — reconnect", () => {
  it("re-hydrates silently on socket reconnect without a success toast", async () => {
    mockFetchSaleroomStatus.mockResolvedValue(LIVE_LOT1);
    mockConnected.value = true;

    renderHook(() => useSaleroomLive(), { wrapper: wrapper("sale-1", INITIAL_NONE) });

    await advanceAndFlush(100);
    mockReportNotice.mockClear();
    mockClearNotice.mockClear();
    mockFetchSaleroomStatus.mockResolvedValue(LIVE_LOT1);

    await act(async () => {
      for (const [event, handler] of mockOn.mock.calls) {
        if (event === "connect" && typeof handler === "function") {
          handler();
        }
      }
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(mockReportNotice).not.toHaveBeenCalled();
    expect(mockClearNotice).toHaveBeenCalledWith("saleroom-hydrate-failed-sale-1");
  });

  it("reports a connectivity notice when a non-silent hydrate fails", async () => {
    mockFetchSaleroomStatus.mockResolvedValue(null);

    renderHook(() => useSaleroomLive(), { wrapper: wrapper("sale-1", INITIAL_NONE) });

    await advanceAndFlush(100);

    expect(mockReportNotice).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "saleroom-hydrate-failed-sale-1",
        message: expect.stringContaining("Could not refresh saleroom status"),
      }),
    );
  });
});
