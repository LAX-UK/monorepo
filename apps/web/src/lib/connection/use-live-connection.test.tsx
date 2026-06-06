import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const notifySuccess = vi.fn();

vi.mock("@/hooks/use-realtime-latency", () => ({
  useRealtimeLatency: vi.fn(),
}));

vi.mock("@/lib/connection/use-browser-online", () => ({
  useBrowserOnline: vi.fn(),
}));

vi.mock("@/lib/ui/notify", () => ({
  notify: { success: (...args: unknown[]) => notifySuccess(...args) },
}));

import { useRealtimeLatency } from "@/hooks/use-realtime-latency";
import { useBrowserOnline } from "@/lib/connection/use-browser-online";
import { useLiveConnection } from "@/lib/connection/use-live-connection";

const mockLatency = vi.mocked(useRealtimeLatency);
const mockOnline = vi.mocked(useBrowserOnline);

describe("useLiveConnection", () => {
  beforeEach(() => {
    notifySuccess.mockClear();
    mockOnline.mockReturnValue(true);
    mockLatency.mockReturnValue({
      state: "connecting",
      rttMs: null,
      lastSampleAt: null,
      lastBidPropagationMs: null,
    });
  });

  it("does not toast on initial connecting-to-live transition", () => {
    const { rerender } = renderHook(() => useLiveConnection());
    mockLatency.mockReturnValue({
      state: "online",
      rttMs: 50,
      lastSampleAt: Date.now(),
      lastBidPropagationMs: null,
    });
    rerender();
    expect(notifySuccess).not.toHaveBeenCalled();
  });

  it("toasts when reconnecting after a prior live session", () => {
    const { rerender } = renderHook(() => useLiveConnection());
    mockLatency.mockReturnValue({
      state: "online",
      rttMs: 50,
      lastSampleAt: Date.now(),
      lastBidPropagationMs: null,
    });
    rerender();
    mockLatency.mockReturnValue({
      state: "offline",
      rttMs: null,
      lastSampleAt: Date.now(),
      lastBidPropagationMs: null,
    });
    rerender();
    mockLatency.mockReturnValue({
      state: "online",
      rttMs: 60,
      lastSampleAt: Date.now(),
      lastBidPropagationMs: null,
    });
    act(() => rerender());
    expect(notifySuccess).toHaveBeenCalledWith("Reconnected — live prices refreshed");
  });
});
