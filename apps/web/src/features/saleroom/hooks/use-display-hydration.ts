import {
  resetDisplayBidLiveState,
  resolveBidSummaryAfterFullHydrate,
  seedDisplayBidLiveFromSnapshot,
} from "@/features/saleroom/lib/display-bid-ticks";
import type { DisplayDataClient } from "@/features/saleroom/lib/display-data-client";
import { resolveOverlayAfterFullHydrate } from "@/features/saleroom/lib/display-overlay-state";
import { useCallback, useEffect } from "react";
import {
  DISPLAY_HYDRATE_DEBOUNCE_MS,
  DISPLAY_RESYNC_INTERVAL_MS,
  type DisplayLiveRefs,
  type DisplayLiveSetState,
  type HydrateMode,
} from "./display-live-state";

export { resolveOverlayAfterFullHydrate } from "@/features/saleroom/lib/display-overlay-state";

export function useDisplayHydration({
  saleId,
  displayToken,
  dataClient,
  setState,
  refs,
  handleUnauthorized,
}: {
  saleId: string;
  displayToken: string;
  dataClient: DisplayDataClient;
  setState: DisplayLiveSetState;
  refs: DisplayLiveRefs;
  handleUnauthorized: () => void;
}) {
  const clearHydrateDebounce = useCallback(() => {
    if (refs.hydrateDebounceRef.current) {
      clearTimeout(refs.hydrateDebounceRef.current);
      refs.hydrateDebounceRef.current = null;
    }
  }, [refs]);

  const hydrate = useCallback(
    async (mode: HydrateMode = "full") => {
      if (refs.hydratingRef.current) return false;
      refs.hydratingRef.current = true;

      try {
        const generation = refs.hydrateGenerationRef.current;
        const overlayGenerationAtStart = refs.overlayGenerationRef.current;
        const result = await dataClient.fetchSnapshot(saleId, displayToken);
        if (generation !== refs.hydrateGenerationRef.current) {
          return false;
        }
        if (!result?.ok) {
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
            if (snapshot.currentLotId !== refs.currentLotIdRef.current) return prev;
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

        const previousLotId = refs.currentLotIdRef.current;
        refs.currentLotIdRef.current = snapshot.currentLotId;
        const wsChangedDuringFetch = refs.overlayGenerationRef.current !== overlayGenerationAtStart;

        setState((prev) => {
          const lotChangedForSeed =
            previousLotId !== null && previousLotId !== snapshot.currentLotId;
          const bidLiveSource = lotChangedForSeed ? resetDisplayBidLiveState() : prev.bidLive;

          return {
            snapshot: resolveBidSummaryAfterFullHydrate(
              prev.snapshot,
              snapshot,
              refs.bidSummaryEmittedAtRef.current,
            ),
            overlay: resolveOverlayAfterFullHydrate(
              prev.overlay,
              snapshot.overlay,
              refs.overlayControlEmittedAtRef.current,
              wsChangedDuringFetch,
            ),
            flash: prev.flash,
            lastHammer: previousLotId !== snapshot.currentLotId ? null : prev.lastHammer,
            connectionStatus: "connected",
            bidLive: seedDisplayBidLiveFromSnapshot(bidLiveSource, snapshot),
          };
        });
        refs.syncJoinedLotRef.current(snapshot.currentLotId);
        return true;
      } finally {
        refs.hydratingRef.current = false;
      }
    },
    [dataClient, displayToken, handleUnauthorized, refs, saleId, setState],
  );

  refs.hydrateRef.current = hydrate;

  const scheduleHydrate = useCallback(() => {
    clearHydrateDebounce();
    refs.hydrateDebounceRef.current = setTimeout(() => {
      refs.hydrateDebounceRef.current = null;
      void refs.hydrateRef.current("merge");
    }, DISPLAY_HYDRATE_DEBOUNCE_MS);
  }, [clearHydrateDebounce, refs]);

  refs.scheduleHydrateRef.current = scheduleHydrate;

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
    const silentHydrate = () => {
      void refs.hydrateRef.current("full");
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        silentHydrate();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    const intervalId = setInterval(silentHydrate, DISPLAY_RESYNC_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearInterval(intervalId);
    };
  }, [refs]);

  return { hydrate, scheduleHydrate, clearHydrateDebounce };
}
