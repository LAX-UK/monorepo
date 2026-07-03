import { useCallback } from "react";
import {
  DISPLAY_PRICE_FLASH_MS,
  type DisplayLiveRefs,
  type DisplayLiveSetState,
} from "./display-live-state";

export function useDisplayBidLive({
  setState,
  refs,
}: {
  setState: DisplayLiveSetState;
  refs: Pick<DisplayLiveRefs, "priceFlashTimerRef">;
}) {
  const clearPriceFlashTimer = useCallback(() => {
    if (refs.priceFlashTimerRef.current) {
      clearTimeout(refs.priceFlashTimerRef.current);
      refs.priceFlashTimerRef.current = null;
    }
  }, [refs.priceFlashTimerRef]);

  const schedulePriceFlashClear = useCallback(() => {
    clearPriceFlashTimer();
    refs.priceFlashTimerRef.current = setTimeout(() => {
      setState((prev) => ({
        ...prev,
        bidLive: { ...prev.bidLive, priceFlash: false },
      }));
      refs.priceFlashTimerRef.current = null;
    }, DISPLAY_PRICE_FLASH_MS);
  }, [clearPriceFlashTimer, refs.priceFlashTimerRef, setState]);

  return { clearPriceFlashTimer, schedulePriceFlashClear };
}
