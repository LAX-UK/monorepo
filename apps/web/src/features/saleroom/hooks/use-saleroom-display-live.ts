"use client";

import {
  type SaleroomSocketAdapter,
  createSaleroomSocketAdapter,
} from "@/features/saleroom/adapters/saleroom-socket.adapter";
import {
  type DisplayBidLiveState,
  type DisplayLastHammer,
  EMPTY_DISPLAY_BID_LIVE_STATE,
  applyDisplayBidSummaryToSnapshot,
  applyDisplayBidUpdate,
  formatDisplayLeaderLabel,
  mergeSnapshotAfterHydrate,
  resetDisplayBidLiveState,
  resolveBidSummaryAfterFullHydrate,
} from "@/features/saleroom/lib/display-bid-ticks";
import {
  type DisplayDataClient,
  createDisplayDataClient,
} from "@/features/saleroom/lib/display-data-client";
import {
  applyDisplayControlEvent,
  resolveOverlayAfterFullHydrate,
} from "@/features/saleroom/lib/display-overlay-state";
import { parseBidUpdateEvent } from "@/lib/realtime/parse-bid-update";
import { applySaleroomEvent } from "@/lib/saleroom/apply-saleroom-event";
import type {
  SaleroomDisplayBidSummary,
  SaleroomDisplayControlPayload,
  SaleroomDisplayOverlay,
  SaleroomDisplaySnapshot,
  SaleroomRealtimePayload,
} from "@auction/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type DisplayFlashKind = "sold" | "passed" | null;

export type SaleroomDisplayLiveState = {
  snapshot: SaleroomDisplaySnapshot | null;
  overlay: SaleroomDisplayOverlay | null;
  flash: DisplayFlashKind;
  lastHammer: DisplayLastHammer | null;
  connectionStatus: "connected" | "reconnecting" | "disconnected";
  bidLive: DisplayBidLiveState;
};

const EMPTY: SaleroomDisplayLiveState = {
  snapshot: null,
  overlay: null,
  flash: null,
  lastHammer: null,
  connectionStatus: "disconnected",
  bidLive: EMPTY_DISPLAY_BID_LIVE_STATE,
};

const PRICE_FLASH_MS = 450;
const HYDRATE_DEBOUNCE_MS = 400;

type HydrateMode = "full" | "merge";

export { resolveOverlayAfterFullHydrate } from "@/features/saleroom/lib/display-overlay-state";

export function useSaleroomDisplayLive({
  saleId,
  displayToken,
  dataClient: dataClientProp,
  socketAdapter: socketAdapterProp,
  onUnauthorized,
}: {
  saleId: string;
  displayToken: string;
  dataClient?: DisplayDataClient;
  socketAdapter?: SaleroomSocketAdapter;
  onUnauthorized?: () => void;
}) {
  const dataClient = useMemo(() => dataClientProp ?? createDisplayDataClient(), [dataClientProp]);
  const socketAdapter = useMemo(
    () => socketAdapterProp ?? createSaleroomSocketAdapter(),
    [socketAdapterProp],
  );
  const [state, setState] = useState<SaleroomDisplayLiveState>(EMPTY);
  const currentLotIdRef = useRef<string | null>(null);
  const soldFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const priceFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrateGenerationRef = useRef(0);
  const overlayGenerationRef = useRef(0);
  const overlayControlEmittedAtRef = useRef<string | null>(null);
  const bidSummaryEmittedAtRef = useRef<string | null>(null);
  const hydratingRef = useRef(false);
  const snapshotRef = useRef<SaleroomDisplaySnapshot | null>(null);
  snapshotRef.current = state.snapshot;
  const syncJoinedLotRef = useRef<(lotId: string | null) => void>(() => {});
  const onUnauthorizedRef = useRef(onUnauthorized);
  onUnauthorizedRef.current = onUnauthorized;

  const clearPriceFlashTimer = useCallback(() => {
    if (priceFlashTimerRef.current) {
      clearTimeout(priceFlashTimerRef.current);
      priceFlashTimerRef.current = null;
    }
  }, []);

  const clearHydrateDebounce = useCallback(() => {
    if (hydrateDebounceRef.current) {
      clearTimeout(hydrateDebounceRef.current);
      hydrateDebounceRef.current = null;
    }
  }, []);

  const schedulePriceFlashClear = useCallback(() => {
    clearPriceFlashTimer();
    priceFlashTimerRef.current = setTimeout(() => {
      setState((prev) => ({
        ...prev,
        bidLive: { ...prev.bidLive, priceFlash: false },
      }));
      priceFlashTimerRef.current = null;
    }, PRICE_FLASH_MS);
  }, [clearPriceFlashTimer]);

  const handleUnauthorized = useCallback(() => {
    onUnauthorizedRef.current?.();
  }, []);

  const hydrate = useCallback(
    async (mode: HydrateMode = "full") => {
      if (hydratingRef.current) return false;
      hydratingRef.current = true;

      try {
        const generation = hydrateGenerationRef.current;
        const overlayGenerationAtStart = overlayGenerationRef.current;
        const result = await dataClient.fetchSnapshot(saleId, displayToken);
        if (generation !== hydrateGenerationRef.current) {
          return false;
        }
        if (!result.ok) {
          if (result.unauthorized) {
            handleUnauthorized();
          } else {
            setState((prev) => ({ ...prev, connectionStatus: "disconnected" }));
          }
          return false;
        }
        const { snapshot } = result;

        if (mode === "merge") {
          setState((prev) => {
            const liveSnapshot = prev.snapshot;
            if (!liveSnapshot?.currentLot) return prev;
            if (snapshot.currentLotId !== currentLotIdRef.current) return prev;
            if (!snapshot.currentLot || snapshot.currentLot.id !== liveSnapshot.currentLot.id) {
              return prev;
            }

            return {
              ...prev,
              snapshot: {
                ...liveSnapshot,
                currentLot: {
                  ...liveSnapshot.currentLot,
                  leaderPaddleNumber: snapshot.currentLot.leaderPaddleNumber,
                },
              },
              connectionStatus: "connected",
            };
          });
          return true;
        }

        const previousLotId = currentLotIdRef.current;
        currentLotIdRef.current = snapshot.currentLotId;
        const wsChangedDuringFetch = overlayGenerationRef.current !== overlayGenerationAtStart;

        setState((prev) => ({
          snapshot: resolveBidSummaryAfterFullHydrate(
            prev.snapshot,
            snapshot,
            bidSummaryEmittedAtRef.current,
          ),
          overlay: resolveOverlayAfterFullHydrate(
            prev.overlay,
            snapshot.overlay,
            overlayControlEmittedAtRef.current,
            wsChangedDuringFetch,
          ),
          flash: prev.flash,
          lastHammer: previousLotId !== snapshot.currentLotId ? null : prev.lastHammer,
          connectionStatus: "connected",
          bidLive: mergeSnapshotAfterHydrate(prev.bidLive, previousLotId, snapshot.currentLotId),
        }));
        syncJoinedLotRef.current(snapshot.currentLotId);
        return true;
      } finally {
        hydratingRef.current = false;
      }
    },
    [dataClient, displayToken, handleUnauthorized, saleId],
  );

  const hydrateRef = useRef(hydrate);
  hydrateRef.current = hydrate;

  const scheduleHydrate = useCallback(() => {
    clearHydrateDebounce();
    hydrateDebounceRef.current = setTimeout(() => {
      hydrateDebounceRef.current = null;
      void hydrateRef.current("merge");
    }, HYDRATE_DEBOUNCE_MS);
  }, [clearHydrateDebounce]);

  const scheduleHydrateRef = useRef(scheduleHydrate);
  scheduleHydrateRef.current = scheduleHydrate;

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const interval = setInterval(() => {
      void dataClient.sendHeartbeat(displayToken).then((result) => {
        if (result === "unauthorized") {
          handleUnauthorized();
        }
      });
    }, 30_000);
    return () => clearInterval(interval);
  }, [dataClient, displayToken, handleUnauthorized]);

  useEffect(() => {
    let joinedLotId: string | null = null;

    const joinLot = (lotId: string | null) => {
      if (joinedLotId) {
        socketAdapter.leaveLot(joinedLotId);
        joinedLotId = null;
      }
      if (lotId) {
        socketAdapter.joinLot(lotId);
        joinedLotId = lotId;
      }
    };

    syncJoinedLotRef.current = joinLot;

    const handleLotTransition = (nextLotId: string | null) => {
      clearHydrateDebounce();
      clearPriceFlashTimer();

      const lotIdChanged = nextLotId !== currentLotIdRef.current;
      if (lotIdChanged) {
        currentLotIdRef.current = nextLotId;
        hydrateGenerationRef.current += 1;
        joinLot(nextLotId);
      }

      if (lotIdChanged && nextLotId) {
        void hydrateRef.current("full");
      }
    };

    const onSaleroom = (raw: unknown) => {
      const event = raw as SaleroomRealtimePayload;
      if (!event || event.saleId !== saleId) return;

      const liveSnapshot = snapshotRef.current;
      if (!liveSnapshot) return;

      const sessionStatus = applySaleroomEvent(
        {
          status: liveSnapshot.sessionStatus === "none" ? "none" : liveSnapshot.sessionStatus,
          currentLotId: liveSnapshot.currentLotId,
        },
        event,
      );
      const lotChanged = sessionStatus.currentLotId !== liveSnapshot.currentLotId;
      const nextLotId = sessionStatus.currentLotId;

      setState((prev) => {
        if (!prev.snapshot) return prev;
        let flash = prev.flash;
        let lastHammer = prev.lastHammer;
        if (event.kind === "hammer") {
          flash = "sold";
          const lot = prev.snapshot.currentLot;
          if (lot) {
            lastHammer = {
              price: lot.currentPrice,
              paddleLabel: formatDisplayLeaderLabel(
                prev.bidLive.leaderPlacedVia,
                lot.leaderPaddleNumber,
              ),
            };
          }
        }
        if (event.kind === "no_sale") flash = "passed";

        return {
          ...prev,
          flash,
          lastHammer,
          snapshot: {
            ...prev.snapshot,
            sessionStatus: sessionStatus.status,
            currentLotId: sessionStatus.currentLotId,
            currentLot: lotChanged ? null : prev.snapshot.currentLot,
          },
          connectionStatus: "connected",
          bidLive: lotChanged ? resetDisplayBidLiveState() : prev.bidLive,
        };
      });

      if (lotChanged) {
        handleLotTransition(nextLotId);
      }

      if (event.kind === "hammer" || event.kind === "no_sale") {
        if (soldFlashTimerRef.current) clearTimeout(soldFlashTimerRef.current);
        soldFlashTimerRef.current = setTimeout(() => {
          setState((prev) => ({ ...prev, flash: null, lastHammer: null }));
        }, 4000);
      }
    };

    const onDisplayControl = (raw: unknown) => {
      const event = raw as SaleroomDisplayControlPayload;
      if (!event || typeof event.kind !== "string") return;

      if (event.kind === "bid_summary") {
        const summary = event as SaleroomDisplayBidSummary;
        bidSummaryEmittedAtRef.current = summary.emittedAt;
        setState((prev) => {
          if (!prev.snapshot) return prev;
          const suppressFlash = prev.flash === "sold" || prev.flash === "passed";
          return {
            ...prev,
            snapshot: applyDisplayBidSummaryToSnapshot(prev.snapshot, summary),
            bidLive: suppressFlash
              ? prev.bidLive
              : { ...prev.bidLive, priceFlash: true, leaderPlacedVia: "saleroom" },
            connectionStatus: "connected",
          };
        });
        schedulePriceFlashClear();
        return;
      }

      overlayGenerationRef.current += 1;
      overlayControlEmittedAtRef.current = event.emittedAt;
      setState((prev) => ({
        ...prev,
        overlay: applyDisplayControlEvent(prev.overlay, event),
        connectionStatus: "connected",
      }));
    };

    const onBidUpdate = (raw: unknown) => {
      const parsed = parseBidUpdateEvent(raw);
      if (!parsed || parsed.lotId !== currentLotIdRef.current) return;

      setState((prev) => {
        if (!prev.snapshot?.currentLot || prev.snapshot.currentLot.id !== parsed.lotId) {
          return prev;
        }
        const suppressFlash = prev.flash === "sold" || prev.flash === "passed";
        const bidLive = applyDisplayBidUpdate(prev.bidLive, parsed, {
          lotId: parsed.lotId,
          suppressFlash,
        });
        return {
          ...prev,
          bidLive,
          snapshot: {
            ...prev.snapshot,
            currentLot: {
              ...prev.snapshot.currentLot,
              currentPrice: parsed.currentPrice,
              bidCount: parsed.bidCount ?? prev.snapshot.currentLot.bidCount,
            },
          },
          connectionStatus: "connected",
        };
      });

      if (parsed) {
        schedulePriceFlashClear();
        scheduleHydrateRef.current();
      }
    };

    const onConnect = () => {
      socketAdapter.joinSaleroom(saleId);
      socketAdapter.joinDisplay(saleId, displayToken);
      joinLot(currentLotIdRef.current);
      setState((prev) => ({ ...prev, connectionStatus: "reconnecting" }));
      void hydrateRef.current();
    };

    const onDisconnect = () => {
      setState((prev) => ({ ...prev, connectionStatus: "disconnected" }));
    };

    socketAdapter.joinSaleroom(saleId);
    socketAdapter.joinDisplay(saleId, displayToken);
    joinLot(currentLotIdRef.current);
    socketAdapter.onSaleroomEvent(onSaleroom);
    socketAdapter.onDisplayControl(onDisplayControl);
    socketAdapter.onBidUpdate(onBidUpdate);
    socketAdapter.onConnect(onConnect);
    socketAdapter.onDisconnect(onDisconnect);

    return () => {
      socketAdapter.offSaleroomEvent(onSaleroom);
      socketAdapter.offDisplayControl(onDisplayControl);
      socketAdapter.offBidUpdate(onBidUpdate);
      socketAdapter.offConnect(onConnect);
      socketAdapter.offDisconnect(onDisconnect);
      socketAdapter.leaveSaleroom(saleId);
      socketAdapter.leaveDisplay(saleId);
      joinLot(null);
      syncJoinedLotRef.current = () => {};
      if (soldFlashTimerRef.current) clearTimeout(soldFlashTimerRef.current);
      clearPriceFlashTimer();
      clearHydrateDebounce();
    };
  }, [
    clearHydrateDebounce,
    clearPriceFlashTimer,
    displayToken,
    saleId,
    schedulePriceFlashClear,
    socketAdapter,
  ]);

  return state;
}

export type { DisplayBidLiveState } from "@/features/saleroom/lib/display-bid-ticks";
