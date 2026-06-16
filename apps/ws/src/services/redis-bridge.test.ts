import { EventEmitter } from "node:events";
import type { Redis } from "ioredis";
import { describe, expect, it, vi } from "vitest";
import { bridgeRedisToSockets } from "./redis-bridge.js";

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
