import { createMockSaleroomSocketAdapter } from "@/features/saleroom/adapters/saleroom-socket.adapter";
import { useSaleroomDisplayLive } from "@/features/saleroom/hooks/use-saleroom-display-live";
import type { DisplayDataClient } from "@/features/saleroom/lib/display-data-client";
import type { SaleroomDisplaySnapshot } from "@auction/types";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

function snapshot(overrides: Partial<SaleroomDisplaySnapshot> = {}): SaleroomDisplaySnapshot {
  return {
    saleId: "sale-1",
    saleTitle: "Hybrid Room A",
    sessionStatus: "live",
    currentLotId: "lot-1",
    currentLot: {
      id: "lot-1",
      lotNumber: 1,
      title: "Lot one",
      imageUrl: null,
      currentPrice: "100.00",
      bidCount: 1,
      leaderPaddleNumber: 205,
    },
    overlay: null,
    ...overrides,
  };
}

function bidPayload(overrides: Record<string, unknown> = {}) {
  return {
    type: "bid_placed",
    lotId: "lot-1",
    currentPrice: "150.00",
    bidCount: 2,
    bid: {
      id: "bid-2",
      bidderId: "user-2",
      placedByUserId: "user-2",
      amount: "150.00",
      placedVia: "saleroom",
    },
    ...overrides,
  };
}

function createMockDataClient(
  fetchImpl: DisplayDataClient["fetchSnapshot"] = vi.fn().mockResolvedValue({
    ok: true,
    snapshot: snapshot(),
  }),
): DisplayDataClient {
  return {
    startPairing: vi.fn(),
    pollPairing: vi.fn(),
    fetchSnapshot: fetchImpl,
    sendHeartbeat: vi.fn().mockResolvedValue("ok"),
  };
}

describe("useSaleroomDisplayLive", () => {
  it("hydrates snapshot on mount", async () => {
    const dataClient = createMockDataClient();
    const adapter = createMockSaleroomSocketAdapter();

    const { result } = renderHook(() =>
      useSaleroomDisplayLive({
        saleId: "sale-1",
        displayToken: "token-1",
        dataClient,
        socketAdapter: adapter,
      }),
    );

    await waitFor(() => {
      expect(result.current.snapshot?.saleTitle).toBe("Hybrid Room A");
    });
    expect(result.current.connectionStatus).toBe("connected");
    expect(adapter.getJoinedLotId()).toBe("lot-1");
  });

  it("updates price, feed, and priceFlash on bidUpdate", async () => {
    const dataClient = createMockDataClient();
    const adapter = createMockSaleroomSocketAdapter();

    const { result } = renderHook(() =>
      useSaleroomDisplayLive({
        saleId: "sale-1",
        displayToken: "token-1",
        dataClient,
        socketAdapter: adapter,
      }),
    );

    await waitFor(() => expect(result.current.snapshot).not.toBeNull());

    act(() => {
      adapter.emitBidUpdate(bidPayload());
    });

    expect(result.current.snapshot?.currentLot?.currentPrice).toBe("150.00");
    expect(result.current.snapshot?.currentLot?.bidCount).toBe(2);
    expect(result.current.bidLive.recentBids).toHaveLength(1);
    expect(result.current.bidLive.priceFlash).toBe(true);

    await waitFor(
      () => {
        expect(result.current.bidLive.priceFlash).toBe(false);
      },
      { timeout: 1000 },
    );
  });

  it("ignores bid updates for other lots", async () => {
    const dataClient = createMockDataClient();
    const adapter = createMockSaleroomSocketAdapter();

    const { result } = renderHook(() =>
      useSaleroomDisplayLive({
        saleId: "sale-1",
        displayToken: "token-1",
        dataClient,
        socketAdapter: adapter,
      }),
    );

    await waitFor(() => expect(result.current.snapshot).not.toBeNull());

    act(() => {
      adapter.emitBidUpdate(bidPayload({ lotId: "lot-other" }));
    });

    expect(result.current.bidLive.recentBids).toHaveLength(0);
    expect(result.current.snapshot?.currentLot?.currentPrice).toBe("100.00");
  });

  it("clears bid feed when lot advances", async () => {
    const fetchSnapshot = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, snapshot: snapshot() })
      .mockResolvedValueOnce({
        ok: true,
        snapshot: snapshot({
          currentLotId: "lot-2",
          currentLot: {
            id: "lot-2",
            lotNumber: 2,
            title: "Lot two",
            imageUrl: null,
            currentPrice: "200.00",
            bidCount: 0,
            leaderPaddleNumber: null,
          },
        }),
      });
    const dataClient = createMockDataClient(fetchSnapshot);
    const adapter = createMockSaleroomSocketAdapter();

    const { result } = renderHook(() =>
      useSaleroomDisplayLive({
        saleId: "sale-1",
        displayToken: "token-1",
        dataClient,
        socketAdapter: adapter,
      }),
    );

    await waitFor(() => expect(result.current.snapshot).not.toBeNull());

    act(() => {
      adapter.emitBidUpdate(bidPayload());
    });
    expect(result.current.bidLive.recentBids).toHaveLength(1);

    act(() => {
      adapter.emit({
        kind: "advanced_to_lot",
        saleId: "sale-1",
        lotId: "lot-2",
        emittedAt: "2026-06-17T10:00:00.000Z",
      });
    });

    expect(result.current.bidLive.recentBids).toHaveLength(0);
    expect(result.current.snapshot?.currentLotId).toBe("lot-2");

    await waitFor(() => {
      expect(result.current.snapshot?.currentLot?.currentPrice).toBe("200.00");
    });
  });

  it("rehydrates on reconnect", async () => {
    const fetchSnapshot = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, snapshot: snapshot() })
      .mockResolvedValueOnce({
        ok: true,
        snapshot: snapshot({
          currentLot: {
            id: "lot-1",
            lotNumber: 1,
            title: "Lot one",
            imageUrl: null,
            currentPrice: "175.00",
            bidCount: 3,
            leaderPaddleNumber: 210,
          },
        }),
      });
    const dataClient = createMockDataClient(fetchSnapshot);
    const adapter = createMockSaleroomSocketAdapter();

    const { result } = renderHook(() =>
      useSaleroomDisplayLive({
        saleId: "sale-1",
        displayToken: "token-1",
        dataClient,
        socketAdapter: adapter,
      }),
    );

    await waitFor(() => expect(result.current.snapshot).not.toBeNull());

    act(() => {
      adapter.simulateConnect();
    });

    await waitFor(() => {
      expect(result.current.snapshot?.currentLot?.currentPrice).toBe("175.00");
    });
    expect(result.current.connectionStatus).toBe("connected");
  });
});
