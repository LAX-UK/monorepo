import type { Redis } from "ioredis";
import type { Server } from "socket.io";

const LOT_EVENTS_PATTERN = "lot:*:events";
const USER_NOTIFICATIONS_PATTERN = "user:*:notifications";

/**
 * Subscribes to Redis pub/sub channels published by the API (`lot:{id}:events`,
 * `user:{userId}:notifications`) and broadcasts JSON payloads to matching Socket.IO rooms.
 */
export function bridgeRedisToSockets(io: Server, sub: Redis): void {
  void sub.psubscribe(LOT_EVENTS_PATTERN, USER_NOTIFICATIONS_PATTERN).catch((err: unknown) => {
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

    const match = /^lot:(.+):events$/.exec(channel);
    const lotId = match?.[1];
    if (!lotId) return;

    try {
      const parsed = JSON.parse(message) as { type?: string };
      const room = `lot:${lotId}`;
      if (parsed.type === "bid_placed") {
        io.to(room).emit("bidUpdate", parsed);
      } else if (parsed.type === "lot_extended") {
        io.to(room).emit("lotExtended", parsed);
      } else if (parsed.type === "lot_ended") {
        io.to(room).emit("lotEnded", parsed);
      } else {
        io.to(room).emit("lotEvent", parsed);
      }
    } catch {
      io.to(`lot:${lotId}`).emit("lotEvent", { raw: message });
    }
  });
}
