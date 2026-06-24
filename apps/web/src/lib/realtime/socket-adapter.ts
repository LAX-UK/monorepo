import type { LotRealtimeCallbacks, LotRealtimePort } from "@/lib/realtime/contracts";
import { parseBidUpdateEvent } from "@/lib/realtime/parse-bid-update";
import { getSocket } from "@/lib/socket";
import type {
  BidUpdateEvent,
  LotEndedEvent,
  LotEndedNoSaleReason,
  LotEndedTrigger,
} from "@auction/types";

function asBidUpdate(raw: unknown): BidUpdateEvent | null {
  return parseBidUpdateEvent(raw);
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
  const noSale = o.noSale === true || o.outcome === "no_sale";
  if (
    (o.type === "lot_ended" || o.type === "auction_ended") &&
    lotId &&
    typeof o.currentPrice === "string" &&
    typeof o.status === "string" &&
    (hasWinner || noSale)
  ) {
    const event: LotEndedEvent = {
      type: "lot_ended",
      lotId,
      winnerId: typeof winnerId === "string" ? winnerId : null,
      bidId: typeof bidId === "string" ? bidId : null,
      currentPrice: o.currentPrice,
      status: o.status,
      outcome:
        o.outcome === "sold" || o.outcome === "no_sale" ? o.outcome : noSale ? "no_sale" : "sold",
    };
    if (noSale) event.noSale = true;
    if (typeof o.noSaleReason === "string") {
      event.noSaleReason = o.noSaleReason as LotEndedNoSaleReason;
    }
    if (typeof o.hadBids === "boolean") event.hadBids = o.hadBids;
    if (typeof o.reserveMet === "boolean") event.reserveMet = o.reserveMet;
    if (typeof o.trigger === "string") {
      event.trigger = o.trigger as LotEndedTrigger;
    }
    return event;
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
          socket.emit("joinLot", { lotId }, () => {});
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
