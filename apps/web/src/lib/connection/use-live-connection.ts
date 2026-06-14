"use client";

import { useRealtimeLatency } from "@/hooks/use-realtime-latency";
import {
  type LiveConnectionState,
  canSubmitBid,
  isRealtimeHealthy,
  liveConnectionMessage,
  mergeConnectionStatus,
} from "@/lib/connection/merge-connection-status";
import { useBrowserOnline } from "@/lib/connection/use-browser-online";
import { notify } from "@/lib/ui/notify";
import { useEffect, useMemo, useRef } from "react";

export type LiveConnectionSnapshot = {
  state: LiveConnectionState;
  message: string | null;
  biddingAllowed: boolean;
  realtimeHealthy: boolean;
};

export function useLiveConnection(): LiveConnectionSnapshot {
  const socket = useRealtimeLatency();
  const browserOnline = useBrowserOnline();
  const state = useMemo(
    () => mergeConnectionStatus(browserOnline, socket),
    [browserOnline, socket],
  );
  const prevStateRef = useRef<LiveConnectionState>(state);
  const hasBeenLiveRef = useRef(false);

  useEffect(() => {
    const prev = prevStateRef.current;
    if (state === "live") {
      if (hasBeenLiveRef.current && (prev === "offline" || prev === "connecting")) {
        notify.success("Reconnected — live prices refreshed");
      }
      hasBeenLiveRef.current = true;
    }
    prevStateRef.current = state;
  }, [state]);

  return {
    state,
    message: liveConnectionMessage(state),
    biddingAllowed: canSubmitBid(state),
    realtimeHealthy: isRealtimeHealthy(state),
  };
}
