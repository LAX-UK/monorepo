import { EventEmitter } from "node:events";
import type { Redis } from "ioredis";
import type { Server, Socket } from "socket.io";
import { describe, expect, it, vi } from "vitest";
import {
  bindSocketIdentity,
  bridgeRedisToSockets,
  disconnectRevokedSockets,
} from "./redis-bridge.js";

describe("Redis socket revocation bridge", () => {
  it("binds authenticated sockets to subject and sid rooms", async () => {
    const join = vi.fn().mockResolvedValue(undefined);
    await bindSocketIdentity({ join } as unknown as Socket, {
      subject: "user-1",
      sid: "sid-1",
    });
    expect(join).toHaveBeenCalledWith(["identity:subject:user-1", "identity:sid:sid-1"]);
  });

  it("disconnects sid matches before the broader subject", () => {
    const disconnectSockets = vi.fn();
    const io = {
      in: vi.fn(() => ({ disconnectSockets })),
    } as unknown as Server;
    disconnectRevokedSockets(io, {
      version: 1,
      subject: "user-1",
      sid: "sid-1",
      reason: "session_revoked",
    });
    expect(io.in).toHaveBeenCalledWith("identity:sid:sid-1");
    expect(disconnectSockets).toHaveBeenCalledWith(true);
  });

  it("disconnects every subject socket for subject-only events and ignores invalid messages", () => {
    let onMessage: ((pattern: string, channel: string, message: string) => void) | undefined;
    const sub = {
      psubscribe: vi.fn().mockResolvedValue(1),
      on: vi.fn(
        (_event: string, handler: (pattern: string, channel: string, message: string) => void) => {
          onMessage = handler;
        },
      ),
    } as unknown as Redis;
    const disconnectSockets = vi.fn();
    const io = {
      in: vi.fn(() => ({ disconnectSockets })),
    } as unknown as Server;
    bridgeRedisToSockets(io, sub);

    onMessage?.(
      "identity:socket-revocation:v1",
      "identity:socket-revocation:v1",
      JSON.stringify({
        version: 1,
        subject: "user-1",
        reason: "credential_change",
      }),
    );
    expect(io.in).toHaveBeenCalledWith("identity:subject:user-1");
    expect(disconnectSockets).toHaveBeenCalledWith(true);

    vi.clearAllMocks();
    onMessage?.(
      "identity:socket-revocation:v1",
      "identity:socket-revocation:v1",
      JSON.stringify({ version: 2, subject: "user-1", reason: "credential_change" }),
    );
    onMessage?.("identity:socket-revocation:v1", "identity:socket-revocation:v1", "{");
    expect(io.in).not.toHaveBeenCalled();
  });
});

const LOT_EVENTS_PATTERN = "lot:*:events";

type MockServer = {
  to: ReturnType<typeof vi.fn>;
};

function createMockIo(): MockServer {
  const emit = vi.fn();
  const to = vi.fn().mockReturnValue({ emit });
  return { to };
}

function createMockSub(): Redis & EventEmitter {
  const sub = new EventEmitter() as Redis & EventEmitter;
  sub.psubscribe = vi.fn().mockResolvedValue(undefined);
  return sub;
}

describe("bridgeRedisToSockets", () => {
  it("emits bidUpdate with outbidUserId for english bid_placed events", () => {
    const io = createMockIo();
    const sub = createMockSub();
    bridgeRedisToSockets(io as never, sub);

    const payload = JSON.stringify({
      type: "bid_placed",
      lotId: "lot-1",
      currentPrice: "150.00",
      outbidUserId: "prev-winner",
      bid: { id: "b1", bidderId: "u2", amount: "150.00" },
    });

    sub.emit("pmessage", LOT_EVENTS_PATTERN, "lot:lot-1:events", payload);

    expect(io.to).toHaveBeenCalledWith("lot:lot-1");
    expect(io.to.mock.results[0]?.value.emit).toHaveBeenCalledWith(
      "bidUpdate",
      expect.objectContaining({
        outbidUserId: "prev-winner",
      }),
    );
  });

  it("emits lotExtended for lot_extended events", () => {
    const io = createMockIo();
    const sub = createMockSub();
    bridgeRedisToSockets(io as never, sub);

    const payload = JSON.stringify({
      type: "lot_extended",
      lotId: "lot-1",
      newEndTime: "2026-06-01T12:00:00.000Z",
    });

    sub.emit("pmessage", LOT_EVENTS_PATTERN, "lot:lot-1:events", payload);

    expect(io.to.mock.results[0]?.value.emit).toHaveBeenCalledWith(
      "lotExtended",
      expect.objectContaining({ newEndTime: "2026-06-01T12:00:00.000Z" }),
    );
  });

  it("emits displayControl to the display room, not the saleroom room", () => {
    const io = createMockIo();
    const sub = createMockSub();
    bridgeRedisToSockets(io as never, sub);

    const payload = JSON.stringify({
      kind: "fair_warning",
      emittedAt: "2026-06-01T12:00:00.000Z",
      saleId: "sale-abc",
    });

    sub.emit("pmessage", "sale:*:display", "sale:sale-abc:display", payload);

    expect(io.to).toHaveBeenCalledWith("display:sale-abc");
    expect(io.to).not.toHaveBeenCalledWith("sale:sale-abc");
    expect(io.to.mock.results[0]?.value.emit).toHaveBeenCalledWith(
      "displayControl",
      expect.objectContaining({ kind: "fair_warning" }),
    );
  });
});
