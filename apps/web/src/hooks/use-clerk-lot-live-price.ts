"use client";

import { parseBidUpdateEvent } from "@/lib/realtime/parse-bid-update";
import { getSocket } from "@/lib/socket";
import { useEffect, useState } from "react";

/** Live current price for the clerk on-block panel (Socket.IO lot room). */
export function useClerkLotLivePrice(lotId: string | null, initialPrice: string): string {
  const [currentPrice, setCurrentPrice] = useState(initialPrice);

  useEffect(() => {
    setCurrentPrice(initialPrice);
    if (!lotId) return;
    const socket = getSocket();

    const onBidUpdate = (raw: unknown) => {
      const mapped = parseBidUpdateEvent(raw);
      if (mapped?.lotId === lotId) {
        setCurrentPrice(mapped.currentPrice);
      }
    };

    const join = () => {
      socket.emit("joinLot", { lotId }, () => {});
    };

    join();
    socket.on("bidUpdate", onBidUpdate);
    socket.on("connect", join);

    return () => {
      socket.off("bidUpdate", onBidUpdate);
      socket.off("connect", join);
      socket.emit("leaveLot", { lotId }, () => {});
    };
  }, [lotId, initialPrice]);

  return currentPrice;
}

export function minNextBidAmount(currentPrice: string, minBidIncrement: string): number {
  const cur = Number.parseFloat(currentPrice);
  const inc = Number.parseFloat(minBidIncrement);
  const safeCur = Number.isFinite(cur) ? cur : 0;
  const safeInc = Number.isFinite(inc) && inc > 0 ? inc : 0.01;
  return safeCur + safeInc;
}
