"use client";

import {
  type SaleroomSocketAdapter,
  createSaleroomSocketAdapter,
} from "@/features/saleroom/adapters/saleroom-socket.adapter";
import {
  type DisplayDataClient,
  createDisplayDataClient,
} from "@/features/saleroom/lib/display-data-client";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  type DisplayLiveRefs,
  EMPTY_SALEROOM_DISPLAY_LIVE_STATE,
  type HydrateMode,
  type SaleroomDisplayLiveState,
} from "./display-live-state";
import { useDisplayBidLive } from "./use-display-bid-live";
import { useDisplayHydration } from "./use-display-hydration";
import { useDisplaySocket } from "./use-display-socket";

export type { DisplayFlashKind, SaleroomDisplayLiveState } from "./display-live-state";
export { resolveOverlayAfterFullHydrate } from "@/features/saleroom/lib/display-overlay-state";
export type { DisplayBidLiveState } from "@/features/saleroom/lib/display-bid-ticks";

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
  const [state, setState] = useState<SaleroomDisplayLiveState>(EMPTY_SALEROOM_DISPLAY_LIVE_STATE);

  const currentLotIdRef = useRef<string | null>(null);
  const soldFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const priceFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrateGenerationRef = useRef(0);
  const overlayGenerationRef = useRef(0);
  const overlayControlEmittedAtRef = useRef<string | null>(null);
  const bidSummaryEmittedAtRef = useRef<string | null>(null);
  const hydratingRef = useRef(false);
  const snapshotRef = useRef(state.snapshot);
  snapshotRef.current = state.snapshot;
  const syncJoinedLotRef = useRef<(lotId: string | null) => void>(() => {});
  const hydrateRef = useRef<(mode?: HydrateMode) => Promise<boolean>>(async () => false);
  const scheduleHydrateRef = useRef<() => void>(() => {});
  const onUnauthorizedRef = useRef(onUnauthorized);
  onUnauthorizedRef.current = onUnauthorized;

  const refs = useMemo<DisplayLiveRefs>(
    () => ({
      currentLotIdRef,
      soldFlashTimerRef,
      priceFlashTimerRef,
      hydrateDebounceRef,
      hydrateGenerationRef,
      overlayGenerationRef,
      overlayControlEmittedAtRef,
      bidSummaryEmittedAtRef,
      hydratingRef,
      snapshotRef,
      syncJoinedLotRef,
      hydrateRef,
      scheduleHydrateRef,
    }),
    [],
  );

  const handleUnauthorized = useCallback(() => {
    onUnauthorizedRef.current?.();
  }, []);

  const { clearPriceFlashTimer, schedulePriceFlashClear } = useDisplayBidLive({ setState, refs });
  const { clearHydrateDebounce } = useDisplayHydration({
    saleId,
    displayToken,
    dataClient,
    setState,
    refs,
    handleUnauthorized,
  });

  useDisplaySocket({
    saleId,
    displayToken,
    socketAdapter,
    setState,
    refs,
    clearHydrateDebounce,
    clearPriceFlashTimer,
    schedulePriceFlashClear,
  });

  return state;
}
