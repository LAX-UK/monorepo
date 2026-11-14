import type { Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { keepRooms } from "./socket-rooms";

// biome-ignore lint/suspicious/noExplicitAny: test listeners take any arguments.
type Listener = (...args: any[]) => void;

/** A stand-in for the Socket.IO client: `timeout(ms)` sets a flag the next `emit` consumes. */
function buildSocket() {
  const sent: Array<{ event: string; args: unknown[]; timeoutMs?: number }> = [];
  const handlers = new Map<string, Listener[]>();
  let flag: number | undefined;
  const socket = {
    connected: false,
    on(event: string, fn: Listener) {
      handlers.set(event, [...(handlers.get(event) ?? []), fn]);
      return socket;
    },
    emit(event: string, ...args: unknown[]) {
      sent.push({ event, args, ...(flag === undefined ? {} : { timeoutMs: flag }) });
      flag = undefined;
      return socket;
    },
    timeout(ms: number) {
      flag = ms;
      return socket;
    },
  };
  return {
    socket: keepRooms(socket as unknown as Socket),
    sent,
    connect() {
      socket.connected = true;
      for (const fn of handlers.get("connect") ?? []) fn();
    },
    disconnect() {
      socket.connected = false;
    },
    /** The server answers the n-th message sent with `event`. */
    reply(event: string, n: number, ...args: unknown[]) {
      const ack = sent.filter((c) => c.event === event)[n]?.args.at(-1) as Listener;
      ack(...args);
    },
    names: () => sent.map((c) => c.event),
  };
}

describe("keepRooms", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("sends a join asked for before the connection opens once, when it opens", () => {
    const t = buildSocket();
    const ack = vi.fn();
    t.socket.emit("joinSaleroom", { saleId: "s1" }, ack);
    t.socket.emit("joinSaleroom", { saleId: "s1" });
    expect(t.names()).toEqual([]);
    t.connect();
    expect(t.names()).toEqual(["joinSaleroom"]);
    expect(t.sent[0]?.args.slice(0, -1)).toEqual([{ saleId: "s1" }]);
    expect(ack).not.toHaveBeenCalled();
    t.reply("joinSaleroom", 0, { ok: true });
    expect(ack).toHaveBeenCalledExactlyOnceWith({ ok: true });
  });

  it("sends a join made while connected at once, and the same one only once", () => {
    const t = buildSocket();
    t.connect();
    t.socket.emit("joinSaleroom", { saleId: "s1" });
    t.socket.emit("joinSaleroom", { saleId: "s1" });
    t.socket.emit("joinSaleroom", { saleId: "s2" });
    t.socket.emit("joinUser", {});
    expect(t.sent.map((c) => [c.event, c.args[0]])).toEqual([
      ["joinSaleroom", { saleId: "s1" }],
      ["joinSaleroom", { saleId: "s2" }],
      ["joinUser", {}],
    ]);
  });

  it("does not send a join twice on one connection when the page joins again on connect", () => {
    const t = buildSocket();
    t.socket.emit("joinSaleroom", { saleId: "s1" }, () => {});
    t.socket.on("connect", () => t.socket.emit("joinSaleroom", { saleId: "s1" }, () => {}));
    t.connect();
    expect(t.names()).toEqual(["joinSaleroom"]);
  });

  it("acks a page's own join on connect once on every connection, first and after a reconnect", () => {
    const t = buildSocket();
    const ack = vi.fn();
    t.socket.on("connect", () => t.socket.emit("joinSaleroom", { saleId: "s1" }, ack));
    t.connect();
    t.reply("joinSaleroom", 0, { n: 1 });
    expect(ack.mock.calls).toEqual([[{ n: 1 }]]);

    t.disconnect();
    t.connect();
    expect(t.names()).toEqual(["joinSaleroom", "joinSaleroom"]);
    expect(ack).toHaveBeenCalledTimes(1);
    t.reply("joinSaleroom", 1, { n: 2 });
    expect(ack.mock.calls).toEqual([[{ n: 1 }], [{ n: 2 }]]);
  });

  it("answers an ack asked for after the reply on this connection at once, without sending again", () => {
    const t = buildSocket();
    t.connect();
    t.socket.emit("joinSaleroom", { saleId: "s1" });
    t.reply("joinSaleroom", 0, "joined");
    const ack = vi.fn();
    t.socket.emit("joinSaleroom", { saleId: "s1" }, ack);
    expect(ack).toHaveBeenCalledExactlyOnceWith("joined");
    expect(t.names()).toEqual(["joinSaleroom"]);
  });

  it("sends every wanted join again after a reconnect, and none that were left", () => {
    const t = buildSocket();
    t.connect();
    t.socket.emit("joinSaleroom", { saleId: "s1" });
    t.socket.emit("joinSaleroom", { saleId: "s2" });
    t.socket.emit("joinUser", {});
    t.socket.emit("leaveSaleroom", { saleId: "s2" });
    t.sent.length = 0;
    t.disconnect();
    t.connect();
    expect(t.sent.map((c) => [c.event, c.args[0]])).toEqual([
      ["joinSaleroom", { saleId: "s1" }],
      ["joinUser", {}],
    ]);
  });

  it("sends a leave only for a room that was joined, and none when disconnected", () => {
    const t = buildSocket();
    t.socket.emit("joinSaleroom", { saleId: "s1" });
    t.socket.emit("leaveSaleroom", { saleId: "s1" });
    t.connect();
    expect(t.sent).toEqual([]);

    t.socket.emit("leaveSaleroom", { saleId: "never" });
    expect(t.sent).toEqual([]);
    t.socket.emit("joinSaleroom", { saleId: "s1" });
    t.socket.emit("leaveSaleroom", { saleId: "s1" }, () => {});
    expect(t.names()).toEqual(["joinSaleroom", "leaveSaleroom"]);

    t.socket.emit("joinSaleroom", { saleId: "s3" });
    t.disconnect();
    t.socket.emit("leaveSaleroom", { saleId: "s3" });
    t.connect();
    expect(t.names()).toEqual(["joinSaleroom", "leaveSaleroom", "joinSaleroom"]);
  });

  it("sends a timed join through the same path: once, with the reply or a timeout", async () => {
    const t = buildSocket();
    const answered = vi.fn();
    const late = vi.fn();
    t.socket.timeout(1000).emit("joinSaleroom", { saleId: "s1" }, answered);
    t.socket.timeout(500).emit("joinSaleroom", { saleId: "s2" }, late);
    t.socket.emit("joinSaleroom", { saleId: "s1" });
    t.connect();
    expect(t.sent.every((c) => c.timeoutMs === undefined)).toBe(true);
    expect(t.names()).toEqual(["joinSaleroom", "joinSaleroom"]);

    t.reply("joinSaleroom", 0, "ok");
    expect(answered.mock.calls).toEqual([[null, "ok"]]);
    await vi.advanceTimersByTimeAsync(600);
    expect(late).toHaveBeenCalledTimes(1);
    expect(late.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    t.reply("joinSaleroom", 1, "too late");
    await vi.advanceTimersByTimeAsync(2000);
    expect(late).toHaveBeenCalledTimes(1);
    expect(answered).toHaveBeenCalledTimes(1);
  });

  it("passes every other message, timed or not, to the socket unchanged", () => {
    const t = buildSocket();
    t.connect();
    t.socket.emit("ping", 1);
    t.socket.timeout(300).emit("joinLot", { lotId: "l1" }, () => {});
    t.socket.emit("toString", 2);
    t.socket.emit("toString", 2);
    t.socket.emit("constructor", 3);
    expect(t.sent.map((c) => [c.event, c.timeoutMs])).toEqual([
      ["ping", undefined],
      ["joinLot", 300],
      ["toString", undefined],
      ["toString", undefined],
      ["constructor", undefined],
    ]);
  });
});
