"use client";

import { applySaleroomEvent } from "@/lib/saleroom/apply-saleroom-event";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import { getSocket } from "@/lib/socket";
import type { SaleroomRealtimePayload } from "@auction/types";
import { useEffect, useState } from "react";

type Options = {
  saleId: string;
  initial: PublicSaleroomSessionStatus;
  /** When true, keep a rolling socket event log for the clerk console. */
  trackLiveFeed?: boolean;
  liveFeedLimit?: number;
};

export function useSaleroomSessionState({
  saleId,
  initial,
  trackLiveFeed = false,
  liveFeedLimit = 40,
}: Options): {
  session: PublicSaleroomSessionStatus;
  liveFeed: SaleroomRealtimePayload[];
} {
  const [session, setSession] = useState<PublicSaleroomSessionStatus>(initial);
  const [liveFeed, setLiveFeed] = useState<SaleroomRealtimePayload[]>([]);

  useEffect(() => {
    setSession(initial);
  }, [initial]);

  useEffect(() => {
    const socket = getSocket();

    const onSaleroom = (raw: unknown) => {
      const event = raw as SaleroomRealtimePayload;
      if (!event || typeof event.kind !== "string" || event.saleId !== saleId) return;
      setSession((prev) => applySaleroomEvent(prev, event));
      if (trackLiveFeed) {
        setLiveFeed((prev) => [event, ...prev].slice(0, liveFeedLimit));
      }
    };

    const join = () => {
      socket.emit("joinSaleroom", { saleId }, () => {});
    };

    join();
    socket.on("saleroomEvent", onSaleroom);
    socket.on("connect", join);

    return () => {
      socket.off("saleroomEvent", onSaleroom);
      socket.off("connect", join);
      socket.emit("leaveSaleroom", { saleId }, () => {});
    };
  }, [liveFeedLimit, saleId, trackLiveFeed]);

  return { session, liveFeed };
}
