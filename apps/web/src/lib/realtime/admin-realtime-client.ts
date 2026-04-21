import { getSocket } from "@/lib/socket";

export type AdminRealtimeClient = {
  joinLotsForBidEvents(lotIds: readonly string[], onBid: () => void): () => void;
};

/** Admin saleroom: join capped lot rooms for `bidUpdate` fan-out. */
export function createAdminRealtimeClient(): AdminRealtimeClient {
  return {
    joinLotsForBidEvents(lotIds, onBid) {
      const socket = getSocket();
      const capped = lotIds.slice(0, 12);
      for (const lotId of capped) {
        socket.emit("joinLot", { lotId }, () => {});
      }
      socket.on("bidUpdate", onBid);
      return () => {
        socket.off("bidUpdate", onBid);
        for (const lotId of capped) {
          socket.emit("leaveLot", { lotId }, () => {});
        }
      };
    },
  };
}
