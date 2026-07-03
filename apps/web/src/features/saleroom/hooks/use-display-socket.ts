import type { SaleroomSocketAdapter } from "@/features/saleroom/adapters/saleroom-socket.adapter";
import {
  applyDisplayBidSummaryToSnapshot,
  applyDisplayBidUpdate,
  formatDisplayLeaderLabel,
  resetDisplayBidLiveState,
} from "@/features/saleroom/lib/display-bid-ticks";
import { applyDisplayControlEvent } from "@/features/saleroom/lib/display-overlay-state";
import { parseBidUpdateEvent } from "@/lib/realtime/parse-bid-update";
import { applySaleroomEvent } from "@/lib/saleroom/apply-saleroom-event";
import type {
  SaleroomDisplayBidSummary,
  SaleroomDisplayControlPayload,
  SaleroomRealtimePayload,
} from "@auction/types";
import { useEffect } from "react";
import type { DisplayLiveRefs, DisplayLiveSetState } from "./display-live-state";

export function useDisplaySocket({
  saleId,
  displayToken,
  socketAdapter,
  setState,
  refs,
  clearHydrateDebounce,
  clearPriceFlashTimer,
  schedulePriceFlashClear,
}: {
  saleId: string;
  displayToken: string;
  socketAdapter: SaleroomSocketAdapter;
  setState: DisplayLiveSetState;
  refs: DisplayLiveRefs;
  clearHydrateDebounce: () => void;
  clearPriceFlashTimer: () => void;
  schedulePriceFlashClear: () => void;
}) {
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

    refs.syncJoinedLotRef.current = joinLot;

    const handleLotTransition = (nextLotId: string | null) => {
      clearHydrateDebounce();
      clearPriceFlashTimer();

      const lotIdChanged = nextLotId !== refs.currentLotIdRef.current;
      if (lotIdChanged) {
        refs.currentLotIdRef.current = nextLotId;
        refs.hydrateGenerationRef.current += 1;
        joinLot(nextLotId);
      }

      if (lotIdChanged && nextLotId) {
        void refs.hydrateRef.current("full");
      }
    };

    const onSaleroom = (raw: unknown) => {
      const event = raw as SaleroomRealtimePayload;
      if (!event || event.saleId !== saleId) return;

      const liveSnapshot = refs.snapshotRef.current;
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
        if (refs.soldFlashTimerRef.current) clearTimeout(refs.soldFlashTimerRef.current);
        refs.soldFlashTimerRef.current = setTimeout(() => {
          setState((prev) => ({ ...prev, flash: null, lastHammer: null }));
        }, 4000);
      }
    };

    const onDisplayControl = (raw: unknown) => {
      const event = raw as SaleroomDisplayControlPayload;
      if (!event || typeof event.kind !== "string") return;

      if (event.kind === "bid_summary") {
        const summary = event as SaleroomDisplayBidSummary;
        refs.bidSummaryEmittedAtRef.current = summary.emittedAt;
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

      refs.overlayGenerationRef.current += 1;
      refs.overlayControlEmittedAtRef.current = event.emittedAt;
      setState((prev) => ({
        ...prev,
        overlay: applyDisplayControlEvent(prev.overlay, event),
        connectionStatus: "connected",
      }));
    };

    const onBidUpdate = (raw: unknown) => {
      const parsed = parseBidUpdateEvent(raw);
      if (!parsed || parsed.lotId !== refs.currentLotIdRef.current) return;

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
        refs.scheduleHydrateRef.current();
      }
    };

    const onConnect = () => {
      socketAdapter.joinSaleroom(saleId);
      socketAdapter.joinDisplay(saleId, displayToken);
      joinLot(refs.currentLotIdRef.current);
      setState((prev) => ({ ...prev, connectionStatus: "reconnecting" }));
      void refs.hydrateRef.current();
    };

    const onDisconnect = () => {
      setState((prev) => ({ ...prev, connectionStatus: "disconnected" }));
    };

    socketAdapter.joinSaleroom(saleId);
    socketAdapter.joinDisplay(saleId, displayToken);
    joinLot(refs.currentLotIdRef.current);
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
      refs.syncJoinedLotRef.current = () => {};
      if (refs.soldFlashTimerRef.current) clearTimeout(refs.soldFlashTimerRef.current);
      clearPriceFlashTimer();
      clearHydrateDebounce();
    };
  }, [
    clearHydrateDebounce,
    clearPriceFlashTimer,
    displayToken,
    refs,
    saleId,
    schedulePriceFlashClear,
    setState,
    socketAdapter,
  ]);
}
