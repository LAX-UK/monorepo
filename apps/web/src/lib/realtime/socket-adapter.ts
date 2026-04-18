import type { LotRealtimeCallbacks, LotRealtimePort } from "@/lib/realtime/contracts";
import { getSocket } from "@/lib/socket";
import type { BidUpdateEvent, LotEndedEvent } from "@auction/types";

/** API Redis payload wraps the bid record (`bid`) plus `currentPrice`. */
function asBidUpdate(raw: unknown): BidUpdateEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const lotId =
    typeof o.lotId === "string" ? o.lotId : typeof o.auctionId === "string" ? o.auctionId : null;
  const bid = o.bid as Record<string, unknown> | undefined;
  if (
    lotId &&
    typeof o.currentPrice === "string" &&
    bid &&
    typeof bid.id === "string" &&
    typeof bid.bidderId === "string" &&
    typeof bid.amount === "string"
  ) {
    return {
      lotId,
      bidId: bid.id,
      bidderId: bid.bidderId,
      amount: bid.amount,
      currentPrice: o.currentPrice,
      endTime: typeof o.endTime === "string" ? o.endTime : undefined,
      outbidUserId: typeof o.outbidUserId === "string" ? o.outbidUserId : undefined,
    };
  }
  return null;
}

function asLotEnded(raw: unknown): LotEndedEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const lotId =
    typeof o.lotId === "string" ? o.lotId : typeof o.auctionId === "string" ? o.auctionId : null;
  if (
    (o.type === "lot_ended" || o.type === "auction_ended") &&
    lotId &&
    typeof o.winnerId === "string" &&
    typeof o.bidId === "string" &&
    typeof o.currentPrice === "string" &&
    typeof o.status === "string"
  ) {
    return {
      type: "lot_ended",
      lotId,
      winnerId: o.winnerId,
      bidId: o.bidId,
      currentPrice: o.currentPrice,
      status: o.status,
    };
  }
  return null;
}

/** Maps Socket.IO rooms + events to the realtime port. */
export function createSocketLotRealtime(): LotRealtimePort {
  const socket = getSocket();

  return {
    subscribeToLot(lotId: string, callbacks: LotRealtimeCallbacks) {
      const onBidUpdate = (payload: unknown) => {
        const mapped = asBidUpdate(payload);
        if (mapped && callbacks.onBidUpdate) callbacks.onBidUpdate(mapped);
      };
      const onExtended = (payload: unknown) => callbacks.onLotExtended?.(payload);
      const onEnded = (payload: unknown) => {
        const mapped = asLotEnded(payload);
        if (mapped && callbacks.onLotEnded) callbacks.onLotEnded(mapped);
      };
      const onEvent = (payload: unknown) => callbacks.onLotEvent?.(payload);

      socket.emit("joinLot", { lotId }, () => {});
      socket.on("bidUpdate", onBidUpdate);
      socket.on("lotExtended", onExtended);
      socket.on("auctionExtended", onExtended);
      socket.on("lotEnded", onEnded);
      socket.on("auctionEnded", onEnded);
      socket.on("lotEvent", onEvent);
      socket.on("auctionEvent", onEvent);

      return () => {
        socket.off("bidUpdate", onBidUpdate);
        socket.off("lotExtended", onExtended);
        socket.off("auctionExtended", onExtended);
        socket.off("lotEnded", onEnded);
        socket.off("auctionEnded", onEnded);
        socket.off("lotEvent", onEvent);
        socket.off("auctionEvent", onEvent);
        socket.emit("leaveLot", { lotId }, () => {});
      };
    },
    leaveLot(lotId: string) {
      socket.emit("leaveLot", { lotId }, () => {});
    },
  };
}
