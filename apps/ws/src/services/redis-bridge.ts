import { captureBackgroundError } from "@auction/observability";
import type { Redis } from "ioredis";
import type { Server } from "socket.io";

const LOT_EVENTS_PATTERN = "lot:*:events";
const USER_NOTIFICATIONS_PATTERN = "user:*:notifications";
const SALEROOM_PATTERN = "sale:*:saleroom";
const MAX_REDIS_MESSAGE_BYTES = 32 * 1024;

/** Subscribes to Redis pub/sub channels published by the API (`lot:{id}:events`,
 * `user:{userId}:notifications`, `sale:{id}:saleroom`) and broadcasts JSON payloads to matching Socket.IO rooms.
 */
export function bridgeRedisToSockets(io: Server, sub: Redis): void {
  void sub
    .psubscribe(LOT_EVENTS_PATTERN, USER_NOTIFICATIONS_PATTERN, SALEROOM_PATTERN)
    .catch((err: unknown) => {
      console.error("Redis psubscribe error", err);
      captureBackgroundError("ws-redis-bridge", err, { tags: { phase: "psubscribe" } });
    });

  sub.on("pmessage", (_pattern, channel, message) => {
    const userMatch = /^user:(.+):notifications$/.exec(channel);
    if (userMatch) {
      const userId = userMatch[1];
      const room = `user:${userId}`;
      try {
        if (message.length > MAX_REDIS_MESSAGE_BYTES) return;
        const parsed = JSON.parse(message) as unknown;
        if (typeof parsed !== "object" || parsed === null) return;
        io.to(room).emit("userNotification", parsed);
      } catch {
        io.to(room).emit("userNotification", { raw: message });
      }
      return;
    }

    const saleRoomMatch = /^sale:(.+):saleroom$/.exec(channel);
    if (saleRoomMatch) {
      const saleId = saleRoomMatch[1];
      const room = `sale:${saleId}`;
      try {
        if (message.length > MAX_REDIS_MESSAGE_BYTES) return;
        const parsed = JSON.parse(message) as unknown;
        if (typeof parsed !== "object" || parsed === null) return;
        io.to(room).emit("saleroomEvent", parsed);
      } catch {
        io.to(room).emit("saleroomEvent", { raw: message });
      }
      return;
    }

    const match = /^lot:(.+):events$/.exec(channel);
    const lotId = match?.[1];
    if (!lotId) return;

    try {
      if (message.length > MAX_REDIS_MESSAGE_BYTES) return;
      const parsed = JSON.parse(message) as { type?: string; sealed?: boolean };
      if (typeof parsed !== "object" || parsed === null) return;
      const room = `lot:${lotId}`;
      if (parsed.type === "bid_placed" && parsed.sealed === true) {
        void io
          .in(room)
          .fetchSockets()
          .then((socks) => {
            for (const s of socks) {
              if (s.data.isAdmin) s.emit("bidUpdate", parsed);
            }
          })
          .catch((err: unknown) => {
            console.error("sealed bid fan-out", err);
            captureBackgroundError("ws-redis-bridge", err, {
              tags: { phase: "sealed-bid-fanout" },
            });
          });
        return;
      }
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
