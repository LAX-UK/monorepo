import { SaleroomLiveProvider, useSaleroomLive } from "@/lib/context/saleroom-live-provider";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
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

const mockNotifyWarning = vi.fn();
const mockNotifySuccess = vi.fn();
vi.mock("@/lib/ui/notify", () => ({
  notify: {
    warning: (...args: unknown[]) => mockNotifyWarning(...args),
    success: (...args: unknown[]) => mockNotifySuccess(...args),
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const INITIAL_NONE: PublicSaleroomSessionStatus = { status: "none", currentLotId: null };
const LIVE_LOT1: PublicSaleroomSessionStatus = { status: "live", currentLotId: "lot-1" };
const LIVE_NO_LOT: PublicSaleroomSessionStatus = { status: "live", currentLotId: null };

function wrapper(saleId: string, initial: PublicSaleroomSessionStatus) {
  return ({ children }: { children: ReactNode }) => (
    <SaleroomLiveProvider saleId={saleId} initial={initial}>
      {children}
    </SaleroomLiveProvider>
  );
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
  mockNotifyWarning.mockReset();
  mockNotifySuccess.mockReset();
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
    mockNotifyWarning.mockClear();

    await advanceAndFlush(15_000);

    expect(mockNotifyWarning).not.toHaveBeenCalled();
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
    mockNotifyWarning.mockClear();

    await act(async () => {
      result.current?.refresh();
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(mockNotifyWarning).not.toHaveBeenCalled();
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

describe("SaleroomLiveProvider — reconnect toast is preserved", () => {
  it("shows a success toast on socket reconnect re-hydrate", async () => {
    mockFetchSaleroomStatus.mockResolvedValue(LIVE_LOT1);
    // Mark as previously connected so reconnect branch fires
    mockConnected.value = true;

    renderHook(() => useSaleroomLive(), { wrapper: wrapper("sale-1", INITIAL_NONE) });

    await advanceAndFlush(100);
    mockNotifySuccess.mockClear();
    mockFetchSaleroomStatus.mockResolvedValue(LIVE_LOT1);

    // Fire the connect event (simulates reconnect)
    await act(async () => {
      for (const [event, handler] of mockOn.mock.calls) {
        if (event === "connect" && typeof handler === "function") {
          handler();
        }
      }
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(mockNotifySuccess).toHaveBeenCalledWith(
      expect.stringContaining("Reconnected"),
      expect.anything(),
    );
  });
});
