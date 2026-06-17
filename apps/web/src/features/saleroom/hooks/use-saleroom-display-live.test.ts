import { createMockSaleroomSocketAdapter } from "@/features/saleroom/adapters/saleroom-socket.adapter";
import {
  resolveOverlayAfterFullHydrate,
  useSaleroomDisplayLive,
} from "@/features/saleroom/hooks/use-saleroom-display-live";
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

describe("resolveOverlayAfterFullHydrate", () => {
  const staleOverlay = {
    kind: "fair_warning" as const,
    emittedAt: "2026-06-17T09:00:00.000Z",
  };
  const liveOverlay = {
    kind: "announcement" as const,
    message: "Break in 5",
    emittedAt: "2026-06-17T10:00:00.000Z",
  };

  it("returns live overlay when WS changed during fetch", () => {
    expect(
      resolveOverlayAfterFullHydrate(liveOverlay, staleOverlay, "2026-06-17T10:00:00.000Z", true),
    ).toEqual(liveOverlay);
  });

  it("keeps cleared overlay when snapshot is stale", () => {
    expect(
      resolveOverlayAfterFullHydrate(null, staleOverlay, "2026-06-17T10:00:00.000Z", false),
    ).toBeNull();
  });

  it("applies snapshot overlay on initial hydrate", () => {
    expect(resolveOverlayAfterFullHydrate(null, staleOverlay, null, false)).toEqual(staleOverlay);
  });

  it("prefers newer live overlay by emittedAt", () => {
    expect(resolveOverlayAfterFullHydrate(liveOverlay, staleOverlay, null, false)).toEqual(
      liveOverlay,
    );
  });
});

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

  it("does not refetch snapshot on unrelated rerenders", async () => {
    const fetchSnapshot = vi.fn().mockResolvedValue({ ok: true, snapshot: snapshot() });
    const dataClient = createMockDataClient(fetchSnapshot);
    const adapter = createMockSaleroomSocketAdapter();

    const { result, rerender } = renderHook(
      (props: { saleId: string; displayToken: string }) =>
        useSaleroomDisplayLive({
          ...props,
          dataClient,
          socketAdapter: adapter,
        }),
      { initialProps: { saleId: "sale-1", displayToken: "token-1" } },
    );

    await waitFor(() => expect(result.current.snapshot).not.toBeNull());
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);

    rerender({ saleId: "sale-1", displayToken: "token-1" });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
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
    const lot2Snapshot = snapshot({
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
    });
    let fetchCalls = 0;
    const fetchSnapshot = vi.fn().mockImplementation(async () => {
      fetchCalls += 1;
      return {
        ok: true as const,
        snapshot: fetchCalls === 1 ? snapshot() : lot2Snapshot,
      };
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
    expect(result.current.snapshot?.currentLot).toBeNull();

    await waitFor(() => {
      expect(result.current.snapshot?.currentLot?.id).toBe("lot-2");
      expect(result.current.snapshot?.currentLot?.currentPrice).toBe("200.00");
    });
  });

  it("does not resurrect overlay when stale full hydrate completes after WS clear", async () => {
    const staleOverlay = {
      kind: "fair_warning" as const,
      emittedAt: "2026-06-17T09:00:00.000Z",
    };
    let resolveReconnect:
      | ((value: { ok: true; snapshot: SaleroomDisplaySnapshot }) => void)
      | undefined;
    const reconnectSnapshot = snapshot({ overlay: staleOverlay });
    const reconnectPromise = new Promise<{ ok: true; snapshot: SaleroomDisplaySnapshot }>(
      (resolve) => {
        resolveReconnect = resolve;
      },
    );
    const fetchSnapshot = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, snapshot: snapshot({ overlay: staleOverlay }) })
      .mockImplementationOnce(() => reconnectPromise);

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
    expect(result.current.overlay?.kind).toBe("fair_warning");

    act(() => {
      adapter.simulateConnect();
    });

    act(() => {
      adapter.emitDisplayControl({
        kind: "clear",
        emittedAt: "2026-06-17T10:00:00.000Z",
      });
    });
    expect(result.current.overlay).toBeNull();

    await act(async () => {
      resolveReconnect?.({ ok: true, snapshot: reconnectSnapshot });
      await reconnectPromise;
    });

    expect(result.current.overlay).toBeNull();
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

  describe("merge hydrate (per-bid)", () => {
    async function advanceMergeHydrate() {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 450));
      });
    }

    it("does not overwrite WS overlay when merge-hydrate returns stale snapshot", async () => {
      let mergeHydrateEnabled = false;
      const fetchSnapshot = vi.fn().mockImplementation(async () => {
        if (mergeHydrateEnabled) {
          return { ok: true as const, snapshot: snapshot({ overlay: null }) };
        }
        return { ok: true as const, snapshot: snapshot() };
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
        adapter.emitDisplayControl({
          kind: "fair_warning",
          emittedAt: "2026-06-17T10:00:00.000Z",
        });
      });
      expect(result.current.overlay?.kind).toBe("fair_warning");

      mergeHydrateEnabled = true;
      act(() => {
        adapter.emitBidUpdate(bidPayload());
      });
      await advanceMergeHydrate();

      expect(result.current.overlay?.kind).toBe("fair_warning");
    });

    it("does not resurrect overlay after WS clear when merge-hydrate is stale", async () => {
      const staleOverlay = {
        kind: "fair_warning" as const,
        emittedAt: "2026-06-17T09:00:00.000Z",
      };
      let mergeHydrateEnabled = false;
      const fetchSnapshot = vi.fn().mockImplementation(async () => {
        if (mergeHydrateEnabled) {
          return {
            ok: true as const,
            snapshot: snapshot({ overlay: staleOverlay }),
          };
        }
        return {
          ok: true as const,
          snapshot: snapshot({ overlay: staleOverlay }),
        };
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
      expect(result.current.overlay?.kind).toBe("fair_warning");

      act(() => {
        adapter.emitDisplayControl({
          kind: "clear",
          emittedAt: "2026-06-17T10:00:00.000Z",
        });
      });
      expect(result.current.overlay).toBeNull();

      mergeHydrateEnabled = true;
      act(() => {
        adapter.emitBidUpdate(bidPayload());
      });
      await advanceMergeHydrate();

      expect(result.current.overlay).toBeNull();
    });

    it("does not revert realtime price when merge-hydrate returns stale snapshot", async () => {
      const staleLot = {
        id: "lot-1",
        lotNumber: 1,
        title: "Lot one",
        imageUrl: null,
        currentPrice: "100.00",
        bidCount: 1,
        leaderPaddleNumber: 205,
      };
      let mergeHydrateEnabled = false;
      const fetchSnapshot = vi.fn().mockImplementation(async () => {
        if (mergeHydrateEnabled) {
          return { ok: true as const, snapshot: snapshot({ currentLot: staleLot }) };
        }
        return { ok: true as const, snapshot: snapshot() };
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

      mergeHydrateEnabled = true;
      act(() => {
        adapter.emitBidUpdate(bidPayload({ currentPrice: "150.00", bidCount: 2 }));
      });
      expect(result.current.snapshot?.currentLot?.currentPrice).toBe("150.00");

      await advanceMergeHydrate();

      expect(result.current.snapshot?.currentLot?.currentPrice).toBe("150.00");
      expect(result.current.snapshot?.currentLot?.bidCount).toBe(2);
    });

    it("merges leaderPaddleNumber from snapshot on per-bid hydrate", async () => {
      const mergedLot = {
        id: "lot-1",
        lotNumber: 1,
        title: "Lot one",
        imageUrl: null,
        currentPrice: "100.00",
        bidCount: 1,
        leaderPaddleNumber: 210,
      };
      let mergeHydrateEnabled = false;
      const fetchSnapshot = vi.fn().mockImplementation(async () => {
        if (mergeHydrateEnabled) {
          return { ok: true as const, snapshot: snapshot({ currentLot: mergedLot }) };
        }
        return { ok: true as const, snapshot: snapshot() };
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
      expect(result.current.snapshot?.currentLot?.leaderPaddleNumber).toBe(205);

      mergeHydrateEnabled = true;
      act(() => {
        adapter.emitBidUpdate(bidPayload());
      });
      await advanceMergeHydrate();

      expect(result.current.snapshot?.currentLot?.leaderPaddleNumber).toBe(210);
    });
  });

  it("applies display bid summary and keeps price ahead of stale hydrate", async () => {
    let resolveStale:
      | ((value: { ok: true; snapshot: SaleroomDisplaySnapshot }) => void)
      | undefined;
    const stalePromise = new Promise<{ ok: true; snapshot: SaleroomDisplaySnapshot }>((resolve) => {
      resolveStale = resolve;
    });
    const fetchSnapshot = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, snapshot: snapshot() })
      .mockImplementationOnce(() => stalePromise);

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
      adapter.emitDisplayControl({
        kind: "bid_summary",
        lotId: "lot-1",
        currentPrice: "200.00",
        bidCount: 4,
        leaderPaddleNumber: 220,
        emittedAt: "2026-06-17T10:05:00.000Z",
      });
    });

    expect(result.current.snapshot?.currentLot?.currentPrice).toBe("200.00");
    expect(result.current.snapshot?.currentLot?.bidCount).toBe(4);

    act(() => {
      adapter.simulateConnect();
    });

    const base = snapshot();
    const staleSnapshot = {
      ...base,
      currentLot: base.currentLot ? { ...base.currentLot, currentPrice: "100.00" } : null,
    };

    await act(async () => {
      resolveStale?.({
        ok: true,
        snapshot: staleSnapshot,
      });
      await stalePromise;
    });

    expect(result.current.snapshot?.currentLot?.currentPrice).toBe("200.00");
  });
});
