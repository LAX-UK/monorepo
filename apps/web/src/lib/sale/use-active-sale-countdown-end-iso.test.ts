import { useActiveSaleCountdownEndIso } from "@/lib/sale/use-active-sale-countdown-end-iso";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/time/use-client-clock", () => ({
  useClientClock: vi.fn(),
}));

import { useClientClock } from "@/lib/time/use-client-clock";

describe("useActiveSaleCountdownEndIso", () => {
  it("returns initialEndIso before client clock mounts", () => {
    vi.mocked(useClientClock).mockReturnValue(null);

    const { result } = renderHook(() =>
      useActiveSaleCountdownEndIso({
        status: "active",
        endTime: "2026-06-02T12:00:00.000Z",
        deliveryMode: "hybrid",
        initialEndIso: "2026-06-02T12:00:00.000Z",
      }),
    );

    expect(result.current).toBe("2026-06-02T12:00:00.000Z");
  });

  it("returns iso for saleroom sale before scheduled end", () => {
    vi.mocked(useClientClock).mockReturnValue(Date.parse("2026-06-01T12:00:00.000Z"));

    const { result } = renderHook(() =>
      useActiveSaleCountdownEndIso({
        status: "active",
        endTime: "2026-06-02T12:00:00.000Z",
        deliveryMode: "hybrid",
        initialEndIso: "2026-06-02T12:00:00.000Z",
      }),
    );

    expect(result.current).toBe("2026-06-02T12:00:00.000Z");
  });

  it("returns undefined for saleroom sale at or after scheduled end", () => {
    vi.mocked(useClientClock).mockReturnValue(Date.parse("2026-06-03T12:00:00.000Z"));

    const { result } = renderHook(() =>
      useActiveSaleCountdownEndIso({
        status: "active",
        endTime: "2026-06-02T12:00:00.000Z",
        deliveryMode: "onsite",
        initialEndIso: "2026-06-02T12:00:00.000Z",
      }),
    );

    expect(result.current).toBeUndefined();
  });

  it("keeps iso for online sale after scheduled end", () => {
    vi.mocked(useClientClock).mockReturnValue(Date.parse("2026-06-03T12:00:00.000Z"));

    const { result } = renderHook(() =>
      useActiveSaleCountdownEndIso({
        status: "active",
        endTime: "2026-06-02T12:00:00.000Z",
        deliveryMode: "online",
        initialEndIso: "2026-06-02T12:00:00.000Z",
      }),
    );

    expect(result.current).toBe("2026-06-02T12:00:00.000Z");
  });
});
