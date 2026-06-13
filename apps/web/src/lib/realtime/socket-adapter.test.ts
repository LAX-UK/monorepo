import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSocketLotRealtime } from "./socket-adapter";

type Handler = (...args: unknown[]) => void;

function buildFakeSocket() {
  const handlers = new Map<string, Set<Handler>>();
  let connected = true;
  const emit = vi.fn((_event: string, _payload: unknown, ack?: () => void) => {
    ack?.();
  });
  const api = {
    get connected() {
      return connected;
    },
    on(event: string, handler: Handler) {
      let set = handlers.get(event);
      if (!set) {
        set = new Set();
        handlers.set(event, set);
      }
      set.add(handler);
      return api;
    },
    off(event: string, handler: Handler) {
      handlers.get(event)?.delete(handler);
      return api;
    },
    emit,
    triggerConnect() {
      connected = true;
      for (const handler of handlers.get("connect") ?? []) {
        handler();
      }
    },
    simulateDisconnect() {
      connected = false;
    },
  };
  return api;
}

const fakeRef = vi.hoisted(() => ({ current: buildFakeSocket() }));

vi.mock("@/lib/socket", () => ({
  getSocket: () => fakeRef.current,
}));

describe("createSocketLotRealtime", () => {
  beforeEach(() => {
    fakeRef.current = buildFakeSocket();
  });

  it("re-emits joinLot on reconnect before onReconnect", () => {
    const onReconnect = vi.fn();
    const port = createSocketLotRealtime();
    const unsubscribe = port.subscribeToLot("lot-a", { onReconnect });

    expect(fakeRef.current.emit).toHaveBeenCalledWith(
      "joinLot",
      { lotId: "lot-a" },
      expect.any(Function),
    );

    fakeRef.current.simulateDisconnect();
    fakeRef.current.triggerConnect();

    expect(fakeRef.current.emit).toHaveBeenCalledTimes(2);
    expect(fakeRef.current.emit).toHaveBeenLastCalledWith(
      "joinLot",
      { lotId: "lot-a" },
      expect.any(Function),
    );
    expect(onReconnect).toHaveBeenCalledOnce();

    unsubscribe();
  });
});
