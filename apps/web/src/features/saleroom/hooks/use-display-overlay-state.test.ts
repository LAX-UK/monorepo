import { createMockSaleroomSocketAdapter } from "@/features/saleroom/adapters/saleroom-socket.adapter";
import { useDisplayOverlayState } from "@/features/saleroom/hooks/use-display-overlay-state";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("useDisplayOverlayState", () => {
  it("hydrates from server and reconciles socket clear events", async () => {
    const fetchOverlay = vi.fn().mockResolvedValue({
      kind: "fair_warning" as const,
      emittedAt: "2026-06-17T10:00:00.000Z",
    });
    const socketAdapter = createMockSaleroomSocketAdapter();

    const { result } = renderHook(() =>
      useDisplayOverlayState({
        saleId: "sale-1",
        fetchOverlay,
        socketAdapter,
        pollIntervalMs: 60_000,
      }),
    );

    await waitFor(() => {
      expect(result.current.activeOverlay?.kind).toBe("fair_warning");
    });

    act(() => {
      socketAdapter.emitDisplayControl({
        kind: "clear",
        emittedAt: "2026-06-17T10:01:00.000Z",
        saleId: "sale-1",
      });
    });

    expect(result.current.activeOverlay).toBeNull();
  });

  it("applies optimistic overlay updates", () => {
    const { result } = renderHook(() =>
      useDisplayOverlayState({
        saleId: "sale-1",
        fetchOverlay: vi.fn().mockResolvedValue(null),
        pollIntervalMs: 60_000,
      }),
    );

    act(() => {
      result.current.setOptimisticOverlay({ kind: "announcement", message: "Final call" });
    });

    expect(result.current.activeOverlay).toEqual({
      kind: "announcement",
      message: "Final call",
    });
  });
});
