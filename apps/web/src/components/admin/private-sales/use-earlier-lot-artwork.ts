import type { DealArtworkOption } from "@auction/validators";
import { useEffect } from "react";
import type { SearchRegisterArtworks } from "./register-artwork-picker";

/** Long enough that typing a reference does not look up every prefix of it. */
const TYPING_PAUSE_MS = 400;

/**
 * When the work's earlier lot offered a register artwork, hands it over to be preselected. Runs
 * only while `enabled` (nothing chosen yet, or only what it chose last time), and after a pause in
 * typing the reference, so half a reference never preselects another work's artwork.
 */
export function useEarlierLotArtwork({
  enabled,
  workReference,
  search,
  onFound,
}: {
  enabled: boolean;
  workReference: string | null;
  search: SearchRegisterArtworks;
  onFound: (artwork: DealArtworkOption, workReference: string) => void;
}) {
  useEffect(() => {
    if (!enabled || !workReference) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      search("")
        .then((result) => {
          if (!cancelled && result.preselected) onFound(result.preselected, workReference);
        })
        // The picker reports a failed search itself when it is opened.
        .catch(() => undefined);
    }, TYPING_PAUSE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, workReference, search, onFound]);
}
