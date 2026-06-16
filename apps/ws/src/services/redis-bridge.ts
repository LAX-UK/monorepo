import { captureBackgroundError } from "@auction/observability";
import type { Redis } from "ioredis";
import type { Server } from "socket.io";

const MAX_REDIS_MESSAGE_BYTES = 32 * 1024;

type ChannelRouter = {
  pattern: string;
  resolveRoom: (channel: string) => string | null;
  emit: (io: Server, room: string, parsed: Record<string, unknown>) => void;
};

function parseJsonMessage(message: string): Record<string, unknown> | null {
  if (message.length > MAX_REDIS_MESSAGE_BYTES) return null;
  try {
    const parsed = JSON.parse(message) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

const channelRouters: ChannelRouter[] = [
  {
    pattern: "user:*:notifications",
    resolveRoom: (channel) => {
      const userMatch = /^user:(.+):notifications$/.exec(channel);
      return userMatch ? `user:${userMatch[1]}` : null;
    },
    emit: (io, room, parsed) => {
      io.to(room).emit("userNotification", parsed);
    },
  },
  {
    pattern: "sale:*:saleroom",
    resolveRoom: (channel) => {
      const saleRoomMatch = /^sale:(.+):saleroom$/.exec(channel);
      return saleRoomMatch ? `sale:${saleRoomMatch[1]}` : null;
    },
    emit: (io, room, parsed) => {
      io.to(room).emit("saleroomEvent", parsed);
    },
  },
  {
    pattern: "sale:*:display",
    resolveRoom: (channel) => {
      const displayMatch = /^sale:(.+):display$/.exec(channel);
      return displayMatch ? `display:${displayMatch[1]}` : null;
    },
    emit: (io, room, parsed) => {
      io.to(room).emit("displayControl", parsed);
    },
  },
  {
    pattern: "lot:*:events",
    resolveRoom: (channel) => {
      const match = /^lot:(.+):events$/.exec(channel);
      return match ? `lot:${match[1]}` : null;
    },
    emit: (io, room, parsed) => {
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
    },
  },
];

/** Subscribes to Redis pub/sub channels published by the API and broadcasts JSON payloads to matching Socket.IO rooms. */
export function bridgeRedisToSockets(io: Server, sub: Redis): void {
  const patterns = channelRouters.map((router) => router.pattern);
  void sub.psubscribe(...patterns).catch((err: unknown) => {
    console.error("Redis psubscribe error", err);
    captureBackgroundError("ws-redis-bridge", err, { tags: { phase: "psubscribe" } });
  });

  sub.on("pmessage", (_pattern, channel, message) => {
    for (const router of channelRouters) {
      const room = router.resolveRoom(channel);
      if (!room) continue;
      const parsed = parseJsonMessage(message);
      if (parsed) {
        router.emit(io, room, parsed);
      } else {
        router.emit(io, room, { raw: message });
      }
      return;
    }
  });
}
