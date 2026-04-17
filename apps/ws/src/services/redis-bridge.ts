import type { Redis } from "ioredis";
import type { Server } from "socket.io";

const AUCTION_EVENTS_PATTERN = "auction:*:events";
const USER_NOTIFICATIONS_PATTERN = "user:*:notifications";

/**
 * Subscribes to Redis pub/sub channels published by the API (`auction:{id}:events`,
 * `user:{userId}:notifications`) and broadcasts JSON payloads to matching Socket.IO rooms.
 */
export function bridgeRedisToSockets(io: Server, sub: Redis): void {
  void sub.psubscribe(AUCTION_EVENTS_PATTERN, USER_NOTIFICATIONS_PATTERN).catch((err: unknown) => {
    console.error("Redis psubscribe error", err);
  });

  sub.on("pmessage", (_pattern, channel, message) => {
    const userMatch = /^user:(.+):notifications$/.exec(channel);
    if (userMatch) {
      const userId = userMatch[1];
      const room = `user:${userId}`;
      try {
        const parsed = JSON.parse(message) as unknown;
        io.to(room).emit("userNotification", parsed);
      } catch {
        io.to(room).emit("userNotification", { raw: message });
      }
      return;
    }

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
