"use client";

import { parseBidUpdateEvent } from "@/lib/realtime/parse-bid-update";
import { getSocket } from "@/lib/socket";
import { useEffect, useState } from "react";

/**
 * The newest price for a lot, pushed by the bidding room, or `null` until a bid arrives. It joins
 * the lot's room only while `enabled`, so a hidden tab or a lot that cannot take bids holds no
 * connection to it. Leaving the room keeps the last price, so a label does not jump back when a
 * tab is hidden and shown again.
 */
export function useLiveLotBid(lotId: string | undefined, enabled: boolean): string | null {
  const [price, setPrice] = useState<string | null>(null);

  useEffect(() => {
    if (!lotId || !enabled) return;
    const socket = getSocket();
    const onBidUpdate = (raw: unknown) => {
      const event = parseBidUpdateEvent(raw);
      if (event?.lotId === lotId) setPrice(event.currentPrice);
    };
    const join = () => socket.emit("joinLot", { lotId }, () => {});
    join();
    socket.on("bidUpdate", onBidUpdate);
    socket.on("connect", join);
    return () => {
      socket.off("bidUpdate", onBidUpdate);
      socket.off("connect", join);
      socket.emit("leaveLot", { lotId }, () => {});
    };
  }, [lotId, enabled]);

  return price;
}
