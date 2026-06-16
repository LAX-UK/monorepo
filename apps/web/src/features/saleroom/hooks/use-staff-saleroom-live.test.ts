import { createMockSaleroomSocketAdapter } from "@/features/saleroom/adapters/saleroom-socket.adapter";
import { useStaffSaleroomLive } from "@/features/saleroom/hooks/use-staff-saleroom-live";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchSaleroomStatus = vi.fn();

vi.mock("@/lib/data/http/saleroom-status.client", () => ({
  fetchSaleroomStatus: (...args: unknown[]) => fetchSaleroomStatus(...args),
}));

vi.mock("@/lib/ui/notify", () => ({
  notify: {
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

describe("useStaffSaleroomLive", () => {
  const initialSession = { status: "live" as const, currentLotId: "lot-1" };

  beforeEach(() => {
    fetchSaleroomStatus.mockReset();
  });

  it("updates session when saleroom socket events arrive", () => {
    const adapter = createMockSaleroomSocketAdapter();

    const { result } = renderHook(() =>
      useStaffSaleroomLive({
        saleId: "sale-1",
        initial: initialSession,
        socketAdapter: adapter,
        notifyOnReconnect: false,
      }),
    );

    act(() => {
      adapter.emit({
        kind: "advanced_to_lot",
        saleId: "sale-1",
        lotId: "lot-2",
        emittedAt: "2026-06-16T10:05:00.000Z",
      });
    });

    expect(result.current.session.currentLotId).toBe("lot-2");
    expect(result.current.session.lastEventAt).toBe("2026-06-16T10:05:00.000Z");
    expect(result.current.session.connectionStatus).toBe("connected");
  });

  it("hydrates from server after reconnect", async () => {
    const adapter = createMockSaleroomSocketAdapter();
    fetchSaleroomStatus.mockResolvedValue({
      status: "paused",
      currentLotId: "lot-9",
    });

    const { result } = renderHook(() =>
      useStaffSaleroomLive({
        saleId: "sale-1",
        initial: initialSession,
        socketAdapter: adapter,
        notifyOnReconnect: false,
      }),
    );

    act(() => {
      adapter.simulateConnect();
    });

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      adapter.simulateConnect();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchSaleroomStatus).toHaveBeenCalledWith("sale-1");
    expect(result.current.session.status).toBe("paused");
    expect(result.current.session.currentLotId).toBe("lot-9");
  });
});
