import type { Redis } from "ioredis";
import type { Server } from "socket.io";

const CHANNEL_PATTERN = "auction:*:events";

/**
 * Subscribes to Redis pub/sub channels published by the API (`auction:{id}:events`)
 * and broadcasts JSON payloads to the matching Socket.IO room.
 */
export function bridgeRedisToSockets(io: Server, sub: Redis): void {
  void sub.psubscribe(CHANNEL_PATTERN).catch((err: unknown) => {
    console.error("Redis psubscribe error", err);
  });

  sub.on("pmessage", (_pattern, channel, message) => {
    const match = /^auction:(.+):events$/.exec(channel);
    const auctionId = match?.[1];
    if (!auctionId) return;

    try {
      const parsed = JSON.parse(message) as { type?: string };
      const room = `auction:${auctionId}`;
      if (parsed.type === "bid_placed") {
        io.to(room).emit("bidUpdate", parsed);
      } else if (parsed.type === "auction_extended") {
        io.to(room).emit("auctionExtended", parsed);
      } else if (parsed.type === "auction_ended") {
        io.to(room).emit("auctionEnded", parsed);
      } else {
        io.to(room).emit("auctionEvent", parsed);
      }
    } catch {
      io.to(`auction:${auctionId}`).emit("auctionEvent", { raw: message });
    }
  });
}
