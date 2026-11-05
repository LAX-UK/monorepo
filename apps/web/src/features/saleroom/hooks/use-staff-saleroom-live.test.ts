import { createMockSaleroomSocketAdapter } from "@/features/saleroom/adapters/saleroom-socket.adapter";
import { useStaffSaleroomLive } from "@/features/saleroom/hooks/use-staff-saleroom-live";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchSaleroomStatus = vi.fn();
const sockets: Array<{
  connected: boolean;
  handlers: Map<string, Set<() => void>>;
}> = [];

// The default adapter wraps the shared browser socket; a fake stands in for it.
vi.mock("@/lib/socket", () => ({
  getSocket: () => {
    // Like the real one, a single socket shared by every caller.
    if (sockets[0]) return sockets[0];
    const handlers = new Map<string, Set<() => void>>();
    const socket = {
      connected: true,
      handlers,
      emit: () => {},
      on: (event: string, handler: () => void) => {
        handlers.set(event, (handlers.get(event) ?? new Set()).add(handler));
      },
      off: (event: string, handler: () => void) => {
        handlers.get(event)?.delete(handler);
      },
    };
    sockets.push(socket);
    return socket;
  },
}));
const mockReportNotice = vi.fn();
const mockClearNotice = vi.fn();

vi.mock("@/lib/data/http/saleroom-status.client", () => ({
  fetchSaleroomStatus: (...args: unknown[]) => fetchSaleroomStatus(...args),
}));

vi.mock("@/lib/connection/live-connectivity-notice", () => ({
  useLiveConnectivityNoticeReporterOptional: () => ({
    reportNotice: (...args: unknown[]) => mockReportNotice(...args),
    clearNotice: (...args: unknown[]) => mockClearNotice(...args),
  }),
}));

describe("useStaffSaleroomLive", () => {
  const initialSession = { status: "live" as const, currentLotId: "lot-1" };

  beforeEach(() => {
    fetchSaleroomStatus.mockReset();
    mockReportNotice.mockReset();
    mockClearNotice.mockReset();
  });

  it("updates session when saleroom socket events arrive", () => {
    const adapter = createMockSaleroomSocketAdapter();

    const { result } = renderHook(() =>
      useStaffSaleroomLive({
        saleId: "sale-1",
        initial: initialSession,
        socketAdapter: adapter,
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
    expect(mockClearNotice).toHaveBeenCalledWith("saleroom-hydrate-failed-sale-1");
  });

  it("hydrates after a reconnect when it builds its own socket adapter", async () => {
    sockets.length = 0;
    fetchSaleroomStatus.mockResolvedValue({ status: "paused", currentLotId: "lot-1" });

    const { result } = renderHook(() =>
      useStaffSaleroomLive({ saleId: "sale-1", initial: initialSession }),
    );
    const fire = (event: string) => {
      for (const socket of sockets) {
        for (const handler of socket.handlers.get(event) ?? []) handler();
      }
    };

    // The drop re-renders the hook. A fresh adapter each render would re-run the effect with the
    // socket already down and forget that it had connected.
    act(() => {
      for (const socket of sockets) socket.connected = false;
      fire("disconnect");
    });
    expect(result.current.session.connectionStatus).toBe("disconnected");

    await act(async () => {
      for (const socket of sockets) socket.connected = true;
      fire("connect");
    });

    expect(fetchSaleroomStatus).toHaveBeenCalledWith("sale-1");
    expect(result.current.session.status).toBe("paused");
    expect(result.current.session.connectionStatus).toBe("connected");
  });

  it("sets connectionStatus to disconnected when socket drops", () => {
    const adapter = createMockSaleroomSocketAdapter();

    const { result } = renderHook(() =>
      useStaffSaleroomLive({
        saleId: "sale-1",
        initial: initialSession,
        socketAdapter: adapter,
      }),
    );

    act(() => {
      adapter.simulateConnect();
    });

    expect(result.current.session.connectionStatus).toBe("connected");

    act(() => {
      adapter.simulateDisconnect();
    });

    expect(result.current.session.connectionStatus).toBe("disconnected");
  });

  it("reports a connectivity notice when reconnect hydrate fails", async () => {
    const adapter = createMockSaleroomSocketAdapter();
    fetchSaleroomStatus.mockResolvedValueOnce(null);

    renderHook(() =>
      useStaffSaleroomLive({
        saleId: "sale-1",
        initial: initialSession,
        socketAdapter: adapter,
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

    expect(mockReportNotice).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "saleroom-hydrate-failed-sale-1",
        message: expect.stringContaining("Could not refresh saleroom status"),
      }),
    );
  });
});
