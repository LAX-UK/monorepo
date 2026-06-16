"use client";

import {
  DISPLAY_TOKEN_STORAGE_KEY,
  type DisplayDataClient,
  createDisplayDataClient,
} from "@/features/saleroom/lib/display-data-client";
import type { SaleroomDisplayPairingStart } from "@auction/types";
import { useCallback, useEffect, useRef, useState } from "react";

type PairingState =
  | { phase: "idle" }
  | { phase: "starting" }
  | { phase: "waiting"; start: SaleroomDisplayPairingStart }
  | { phase: "authorized"; displayToken: string }
  | { phase: "expired" }
  | { phase: "error"; message: string };

export function useDisplayPairing(
  saleId: string,
  dataClient: DisplayDataClient = createDisplayDataClient(),
) {
  const [state, setState] = useState<PairingState>(() => {
    if (typeof window === "undefined") return { phase: "idle" };
    const stored = window.localStorage.getItem(DISPLAY_TOKEN_STORAGE_KEY(saleId));
    return stored ? { phase: "authorized", displayToken: stored } : { phase: "idle" };
  });
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPoll = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const beginPairing = useCallback(async () => {
    clearPoll();
    setState({ phase: "starting" });
    const start = await dataClient.startPairing();
    if (!start) {
      setState({ phase: "error", message: "Could not start pairing" });
      return;
    }
    setState({ phase: "waiting", start });
  }, [clearPoll, dataClient]);

  useEffect(() => {
    if (state.phase !== "waiting") return;
    const { start } = state;

    const poll = async () => {
      const result = await dataClient.pollPairing(start.deviceCode);
      if (!result) {
        pollTimerRef.current = setTimeout(() => void poll(), start.interval * 1000);
        return;
      }
      if (result.status === "authorized") {
        if (result.saleId !== saleId) {
          setState({
            phase: "error",
            message:
              "This display was approved for a different sale. Open the correct display URL or ask staff to approve again.",
          });
          return;
        }
        window.localStorage.setItem(DISPLAY_TOKEN_STORAGE_KEY(saleId), result.displayToken);
        setState({ phase: "authorized", displayToken: result.displayToken });
        return;
      }
      if (result.status === "expired") {
        setState({ phase: "expired" });
        return;
      }
      pollTimerRef.current = setTimeout(() => void poll(), start.interval * 1000);
    };

    pollTimerRef.current = setTimeout(() => void poll(), start.interval * 1000);
    return clearPoll;
  }, [clearPoll, dataClient, saleId, state]);

  const disconnect = useCallback(() => {
    clearPoll();
    window.localStorage.removeItem(DISPLAY_TOKEN_STORAGE_KEY(saleId));
    setState({ phase: "idle" });
  }, [clearPoll, saleId]);

  return { state, beginPairing, disconnect };
}
