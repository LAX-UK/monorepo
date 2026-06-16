"use client";

import {
  type SaleroomSocketAdapter,
  createSaleroomSocketAdapter,
} from "@/features/saleroom/adapters/saleroom-socket.adapter";
import {
  type DisplayBidLiveState,
  EMPTY_DISPLAY_BID_LIVE_STATE,
  applyDisplayBidUpdate,
  mergeSnapshotAfterHydrate,
  resetDisplayBidLiveState,
} from "@/features/saleroom/lib/display-bid-ticks";
import {
  type DisplayDataClient,
  createDisplayDataClient,
} from "@/features/saleroom/lib/display-data-client";
import { parseBidUpdateEvent } from "@/lib/realtime/parse-bid-update";
import { applySaleroomEvent } from "@/lib/saleroom/apply-saleroom-event";
import type {
  SaleroomDisplayControlPayload,
  SaleroomDisplayOverlay,
  SaleroomDisplaySnapshot,
  SaleroomRealtimePayload,
} from "@auction/types";
import { useCallback, useEffect, useRef, useState } from "react";

export type DisplayFlashKind = "sold" | "passed" | null;

export type SaleroomDisplayLiveState = {
  snapshot: SaleroomDisplaySnapshot | null;
  overlay: SaleroomDisplayOverlay | null;
  flash: DisplayFlashKind;
  connectionStatus: "connected" | "reconnecting" | "disconnected";
  bidLive: DisplayBidLiveState;
};

const EMPTY: SaleroomDisplayLiveState = {
  snapshot: null,
  overlay: null,
  flash: null,
  connectionStatus: "disconnected",
  bidLive: EMPTY_DISPLAY_BID_LIVE_STATE,
};

const PRICE_FLASH_MS = 450;
const HYDRATE_DEBOUNCE_MS = 400;

function applyOverlayEvent(
  prev: SaleroomDisplayOverlay | null,
  event: SaleroomDisplayControlPayload,
): SaleroomDisplayOverlay | null {
  if (event.kind === "clear") return null;
  const emittedAt = event.emittedAt;
  if (prev && prev.emittedAt > emittedAt) return prev;
  return {
    kind: event.kind,
    ...(event.message ? { message: event.message } : {}),
    emittedAt,
  };
}

export function useSaleroomDisplayLive({
  saleId,
  displayToken,
  dataClient = createDisplayDataClient(),
  socketAdapter = createSaleroomSocketAdapter(),
  onUnauthorized,
}: {
  saleId: string;
  displayToken: string;
  dataClient?: DisplayDataClient;
  socketAdapter?: SaleroomSocketAdapter;
  onUnauthorized?: () => void;
}) {
  const [state, setState] = useState<SaleroomDisplayLiveState>(EMPTY);
  const currentLotIdRef = useRef<string | null>(null);
  const soldFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const priceFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrateGenerationRef = useRef(0);
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

  const hydrate = useCallback(async () => {
    const generation = hydrateGenerationRef.current;
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
    const previousLotId = currentLotIdRef.current;
    currentLotIdRef.current = snapshot.currentLotId;

    setState((prev) => ({
      snapshot,
      overlay: snapshot.overlay,
      flash: prev.flash,
      connectionStatus: "connected",
      bidLive: mergeSnapshotAfterHydrate(prev.bidLive, previousLotId, snapshot.currentLotId),
    }));
    syncJoinedLotRef.current(snapshot.currentLotId);
    return true;
  }, [dataClient, displayToken, handleUnauthorized, saleId]);

  const scheduleHydrate = useCallback(() => {
    clearHydrateDebounce();
    hydrateDebounceRef.current = setTimeout(() => {
      hydrateDebounceRef.current = null;
      void hydrate();
    }, HYDRATE_DEBOUNCE_MS);
  }, [clearHydrateDebounce, hydrate]);

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
      if (nextLotId === currentLotIdRef.current) return;
      currentLotIdRef.current = nextLotId;
      hydrateGenerationRef.current += 1;
      clearHydrateDebounce();
      clearPriceFlashTimer();
      joinLot(nextLotId);
      if (nextLotId) {
        void hydrate();
      }
    };

    const onSaleroom = (raw: unknown) => {
      const event = raw as SaleroomRealtimePayload;
      if (!event || event.saleId !== saleId) return;

      let nextLotId: string | null | undefined;
      let lotChanged = false;

      setState((prev) => {
        if (!prev.snapshot) return prev;
        const sessionStatus = applySaleroomEvent(
          {
            status: prev.snapshot.sessionStatus === "none" ? "none" : prev.snapshot.sessionStatus,
            currentLotId: prev.snapshot.currentLotId,
          },
          event,
        );
        let flash = prev.flash;
        if (event.kind === "hammer") flash = "sold";
        if (event.kind === "no_sale") flash = "passed";

        nextLotId = sessionStatus.currentLotId;
        lotChanged = nextLotId !== currentLotIdRef.current;

        return {
          ...prev,
          flash,
          snapshot: {
            ...prev.snapshot,
            sessionStatus: sessionStatus.status,
            currentLotId: sessionStatus.currentLotId,
          },
          connectionStatus: "connected",
          bidLive: lotChanged ? resetDisplayBidLiveState() : prev.bidLive,
        };
      });

      if (lotChanged && nextLotId !== undefined) {
        handleLotTransition(nextLotId);
      }

      if (event.kind === "hammer" || event.kind === "no_sale") {
        if (soldFlashTimerRef.current) clearTimeout(soldFlashTimerRef.current);
        soldFlashTimerRef.current = setTimeout(() => {
          setState((prev) => ({ ...prev, flash: null }));
        }, 4000);
      }
    };

    const onDisplayControl = (raw: unknown) => {
      const event = raw as SaleroomDisplayControlPayload;
      if (!event || typeof event.kind !== "string") return;
      setState((prev) => ({
        ...prev,
        overlay: applyOverlayEvent(prev.overlay, event),
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
        scheduleHydrate();
      }
    };

    const onConnect = () => {
      socketAdapter.joinSaleroom(saleId);
      socketAdapter.joinDisplay(saleId, displayToken);
      joinLot(currentLotIdRef.current);
      setState((prev) => ({ ...prev, connectionStatus: "reconnecting" }));
      void hydrate();
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
    hydrate,
    saleId,
    scheduleHydrate,
    schedulePriceFlashClear,
    socketAdapter,
  ]);

  return state;
}

export type { DisplayBidLiveState } from "@/features/saleroom/lib/display-bid-ticks";
