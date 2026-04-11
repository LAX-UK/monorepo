import type { AuctionRealtimeCallbacks, AuctionRealtimePort } from "@/lib/realtime/contracts";
import { getSocket } from "@/lib/socket";
import type { BidUpdateEvent } from "@auction/types";

/** API Redis payload wraps the bid record (`bid`) plus `currentPrice`. */
function asBidUpdate(raw: unknown): BidUpdateEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const bid = o.bid as Record<string, unknown> | undefined;
  if (
    typeof o.auctionId === "string" &&
    typeof o.currentPrice === "string" &&
    bid &&
    typeof bid.id === "string" &&
    typeof bid.bidderId === "string" &&
    typeof bid.amount === "string"
  ) {
    return {
      auctionId: o.auctionId,
      bidId: bid.id,
      bidderId: bid.bidderId,
      amount: bid.amount,
      currentPrice: o.currentPrice,
      endTime: typeof o.endTime === "string" ? o.endTime : undefined,
    };
  }
  return null;
}

/** Maps Socket.IO rooms + events to the realtime port. */
export function createSocketAuctionRealtime(): AuctionRealtimePort {
  const socket = getSocket();

  return {
    subscribeToAuction(auctionId: string, callbacks: AuctionRealtimeCallbacks) {
      const onBidUpdate = (payload: unknown) => {
        const mapped = asBidUpdate(payload);
        if (mapped && callbacks.onBidUpdate) callbacks.onBidUpdate(mapped);
      };
      const onExtended = (payload: unknown) => callbacks.onAuctionExtended?.(payload);
      const onEvent = (payload: unknown) => callbacks.onAuctionEvent?.(payload);

      socket.emit("joinAuction", { auctionId }, () => {});
      socket.on("bidUpdate", onBidUpdate);
      socket.on("auctionExtended", onExtended);
      socket.on("auctionEvent", onEvent);

      return () => {
        socket.off("bidUpdate", onBidUpdate);
        socket.off("auctionExtended", onExtended);
        socket.off("auctionEvent", onEvent);
        socket.emit("leaveAuction", { auctionId }, () => {});
      };
    },
    leaveAuction(auctionId: string) {
      socket.emit("leaveAuction", { auctionId }, () => {});
    },
  };
}
