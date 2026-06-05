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
    const placedByUserId =
      typeof bid.placedByUserId === "string"
        ? bid.placedByUserId
        : typeof bid.bidderId === "string"
          ? bid.bidderId
          : undefined;
    return {
      lotId,
      bidId: bid.id,
      bidderId: bid.bidderId,
      amount: bid.amount,
      currentPrice: o.currentPrice,
      endTime: typeof o.endTime === "string" ? o.endTime : undefined,
      outbidUserId: typeof o.outbidUserId === "string" ? o.outbidUserId : undefined,
      emittedAt:
        typeof o.emittedAt === "number" && Number.isFinite(o.emittedAt) ? o.emittedAt : undefined,
      isAutoBid: bid.isAutoBid === true,
      placedByUserId,
      autoBidStepAmount:
        typeof bid.autoBidStepAmount === "string" ? bid.autoBidStepAmount : undefined,
    };
  }
  return null;
}

function asLotEnded(raw: unknown): LotEndedEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const lotId =
    typeof o.lotId === "string" ? o.lotId : typeof o.auctionId === "string" ? o.auctionId : null;
  const winnerId = o.winnerId;
  const bidId = o.bidId;
  const hasWinner =
    typeof winnerId === "string" && winnerId.length > 0 && typeof bidId === "string";
  const noSale = o.noSale === true;
  if (
    (o.type === "lot_ended" || o.type === "auction_ended") &&
    lotId &&
    typeof o.currentPrice === "string" &&
    typeof o.status === "string" &&
    (hasWinner || noSale)
  ) {
    return {
      type: "lot_ended",
      lotId,
      ...(typeof winnerId === "string" ? { winnerId } : { winnerId: null }),
      ...(typeof bidId === "string" ? { bidId } : { bidId: null }),
      currentPrice: o.currentPrice,
      status: o.status,
      ...(noSale ? { noSale: true } : {}),
    };
  }
  return null;
}

/** Maps Socket.IO rooms + events to the realtime port. */
export function createSocketLotRealtime(): LotRealtimePort {
  const socket = getSocket();
  let hadConnected = socket.connected;

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

      const onConnect = () => {
        if (hadConnected) {
          callbacks.onReconnect?.();
        }
        hadConnected = true;
      };
      socket.on("connect", onConnect);

      return () => {
        socket.off("connect", onConnect);
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
