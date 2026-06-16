"use client";

import {
  type SaleroomSocketAdapter,
  createSaleroomSocketAdapter,
} from "@/features/saleroom/adapters/saleroom-socket.adapter";
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
};

const EMPTY: SaleroomDisplayLiveState = {
  snapshot: null,
  overlay: null,
  flash: null,
  connectionStatus: "disconnected",
};

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
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onUnauthorizedRef = useRef(onUnauthorized);
  onUnauthorizedRef.current = onUnauthorized;

  const handleUnauthorized = useCallback(() => {
    onUnauthorizedRef.current?.();
  }, []);

  const hydrate = useCallback(async () => {
    const result = await dataClient.fetchSnapshot(saleId, displayToken);
    if (!result.ok) {
      if (result.unauthorized) {
        handleUnauthorized();
      } else {
        setState((prev) => ({ ...prev, connectionStatus: "disconnected" }));
      }
      return false;
    }
    const { snapshot } = result;
    currentLotIdRef.current = snapshot.currentLotId;
    setState({
      snapshot,
      overlay: snapshot.overlay,
      flash: null,
      connectionStatus: "connected",
    });
    return true;
  }, [dataClient, displayToken, handleUnauthorized, saleId]);

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

    const onSaleroom = (raw: unknown) => {
      const event = raw as SaleroomRealtimePayload;
      if (!event || event.saleId !== saleId) return;

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

        const nextLotId = sessionStatus.currentLotId;
        if (nextLotId !== currentLotIdRef.current) {
          currentLotIdRef.current = nextLotId;
          joinLot(nextLotId);
          if (nextLotId) {
            void hydrate();
          }
        }

        return {
          ...prev,
          flash,
          snapshot: {
            ...prev.snapshot,
            sessionStatus: sessionStatus.status,
            currentLotId: sessionStatus.currentLotId,
          },
          connectionStatus: "connected",
        };
      });

      if (event.kind === "hammer" || event.kind === "no_sale") {
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        flashTimerRef.current = setTimeout(() => {
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
        return {
          ...prev,
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
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, [displayToken, hydrate, saleId, socketAdapter]);

  return state;
}
