import type { Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type SocketConnectionModule, createLazySocket, retryDelayMs } from "./socket";

// biome-ignore lint/suspicious/noExplicitAny: test listeners take any arguments.
type Listener = (...args: any[]) => void;

type Call = [string, string, ...unknown[]];

/** A stand-in for the Socket.IO client: records every call and lets the test play the server. */
function buildFakeSocket() {
  const calls: Call[] = [];
  const listeners = new Map<string, Listener[]>();
  const managerListeners = new Map<string, Listener[]>();
  const add = (map: Map<string, Listener[]>, event: string, fn: Listener) => {
    map.set(event, [...(map.get(event) ?? []), fn]);
  };
  const remove = (map: Map<string, Listener[]>, event: string, fn?: Listener) => {
    if (!fn) map.delete(event);
    else
      map.set(
        event,
        (map.get(event) ?? []).filter((l) => l !== fn),
      );
  };
  const fake = {
    connected: false,
    calls,
    on(event: string, fn: Listener) {
      calls.push(["on", event]);
      add(listeners, event, fn);
      return fake;
    },
    off(event: string, fn?: Listener) {
      calls.push(["off", event]);
      remove(listeners, event, fn);
      return fake;
    },
    emit(event: string, ...args: unknown[]) {
      calls.push(["emit", event, ...args]);
      return fake;
    },
    timeout(ms: number) {
      return {
        emit(event: string, ...args: unknown[]) {
          calls.push(["timeoutEmit", event, ms, ...args]);
          return fake;
        },
      };
    },
    io: {
      on(event: string, fn: Listener) {
        calls.push(["io.on", event]);
        add(managerListeners, event, fn);
      },
      off(event: string, fn?: Listener) {
        calls.push(["io.off", event]);
        remove(managerListeners, event, fn);
      },
      emitReserved(event: string, ...args: unknown[]) {
        fake.managerEmit(event, ...args);
      },
    },
    /** The server sends an event, or the client raises a reserved one such as `connect`. */
    serverEmit(event: string, ...args: unknown[]) {
      if (event === "connect") fake.connected = true;
      if (event === "disconnect") fake.connected = false;
      for (const fn of [...(listeners.get(event) ?? [])]) fn(...args);
    },
    managerEmit(event: string, ...args: unknown[]) {
      for (const fn of [...(managerListeners.get(event) ?? [])]) fn(...args);
    },
  };
  return fake;
}

type FakeSocket = ReturnType<typeof buildFakeSocket>;

function deferredLoader() {
  let resolve!: (mod: SocketConnectionModule) => void;
  let reject!: (err: unknown) => void;
  const load = vi.fn(
    () =>
      new Promise<SocketConnectionModule>((res, rej) => {
        resolve = res;
        reject = rej;
      }),
  );
  return {
    load,
    arrive(fake: FakeSocket) {
      resolve({ createSocketConnection: () => fake as unknown as Socket });
    },
    fail(err: unknown) {
      reject(err);
    },
  };
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe("createLazySocket", () => {
  it("starts fetching the client as soon as it is created, once", async () => {
    const loader = deferredLoader();
    const socket = createLazySocket(loader.load);
    socket.on("bidUpdate", () => {});
    socket.emit("joinLot", { lotId: "l1" });
    expect(loader.load).toHaveBeenCalledTimes(1);
    expect(socket.connected).toBe(false);
  });

  it("replays listeners and emits on the real socket in the order they were made", async () => {
    const loader = deferredLoader();
    const socket = createLazySocket(loader.load);
    const ack = () => {};
    const onBid = () => {};
    const onConnect = () => {};
    socket.emit("joinSaleroom", { saleId: "s1" }, ack);
    socket.on("saleroomEvent", onBid);
    socket.on("connect", onConnect);
    socket.emit("joinLot", { lotId: "l1" }, ack);
    socket.io.on("reconnect", () => {});
    socket.timeout(2000).emit("latencyProbe", { clientNow: 1 }, ack);

    const fake = buildFakeSocket();
    loader.arrive(fake);
    await flush();

    expect(fake.calls).toEqual([
      ["emit", "joinSaleroom", { saleId: "s1" }, ack],
      ["on", "saleroomEvent"],
      ["on", "connect"],
      ["emit", "joinLot", { lotId: "l1" }, ack],
      ["io.on", "reconnect"],
      // The ack timer started at the call, so only what is left of the 2 s is passed on.
      ["timeoutEmit", "latencyProbe", expect.any(Number), { clientNow: 1 }, ack],
    ]);
    const left = fake.calls[5]?.[2] as number;
    expect(left).toBeGreaterThan(1500);
    expect(left).toBeLessThanOrEqual(2000);
  });

  it("delivers events to listeners that subscribed before the client arrived", async () => {
    const loader = deferredLoader();
    const socket = createLazySocket(loader.load);
    const onBid = vi.fn();
    const onConnect = vi.fn();
    socket.on("bidUpdate", onBid);
    socket.on("connect", onConnect);

    const fake = buildFakeSocket();
    loader.arrive(fake);
    await flush();

    fake.serverEmit("connect");
    fake.serverEmit("bidUpdate", { lotId: "l1", amount: 1 });
    fake.serverEmit("bidUpdate", { lotId: "l1", amount: 2 });

    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(onBid.mock.calls).toEqual([[{ lotId: "l1", amount: 1 }], [{ lotId: "l1", amount: 2 }]]);
    expect(socket.connected).toBe(true);
  });

  it("an unsubscribe made before the client arrived is kept, and the leave is sent after the join", async () => {
    const loader = deferredLoader();
    const socket = createLazySocket(loader.load);
    const onBid = vi.fn();
    socket.emit("joinLot", { lotId: "l1" });
    socket.on("bidUpdate", onBid);
    socket.off("bidUpdate", onBid);
    socket.emit("leaveLot", { lotId: "l1" });

    const fake = buildFakeSocket();
    loader.arrive(fake);
    await flush();
    fake.serverEmit("bidUpdate", { lotId: "l1" });

    expect(onBid).not.toHaveBeenCalled();
    const emits = fake.calls.filter((c) => c[0] === "emit").map((c) => c[1]);
    expect(emits).toEqual(["joinLot", "leaveLot"]);
  });

  it("passes calls straight through once the client is there", async () => {
    const loader = deferredLoader();
    const socket = createLazySocket(loader.load);
    const fake = buildFakeSocket();
    loader.arrive(fake);
    await flush();

    const onEvent = vi.fn();
    socket.on("lotEvent", onEvent);
    socket.emit("joinUser", {});
    expect(fake.calls).toEqual([
      ["on", "lotEvent"],
      ["emit", "joinUser", {}],
    ]);
    fake.serverEmit("lotEvent", 1);
    socket.off("lotEvent", onEvent);
    fake.serverEmit("lotEvent", 2);
    expect(onEvent.mock.calls).toEqual([[1]]);
  });

  it("keeps listeners through a reconnect", async () => {
    const loader = deferredLoader();
    const socket = createLazySocket(loader.load);
    const onConnect = vi.fn();
    const onDisconnect = vi.fn();
    const onReconnect = vi.fn();
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.io.on("reconnect", onReconnect);

    const fake = buildFakeSocket();
    loader.arrive(fake);
    await flush();

    fake.serverEmit("connect");
    fake.serverEmit("disconnect");
    expect(socket.connected).toBe(false);
    fake.managerEmit("reconnect", 1);
    fake.serverEmit("connect");

    expect(onConnect).toHaveBeenCalledTimes(2);
    expect(onDisconnect).toHaveBeenCalledTimes(1);
    expect(onReconnect).toHaveBeenCalledWith(1);
    expect(socket.connected).toBe(true);
  });

  it("serves several subscribers to one event, before and after the client arrives", async () => {
    const loader = deferredLoader();
    const socket = createLazySocket(loader.load);
    const first = vi.fn();
    const second = vi.fn();
    const late = vi.fn();
    socket.on("bidUpdate", first);
    socket.on("bidUpdate", second);

    const fake = buildFakeSocket();
    loader.arrive(fake);
    await flush();
    socket.on("bidUpdate", late);

    fake.serverEmit("bidUpdate", "a");
    socket.off("bidUpdate", first);
    fake.serverEmit("bidUpdate", "b");

    expect(first.mock.calls).toEqual([["a"]]);
    expect(second.mock.calls).toEqual([["a"], ["b"]]);
    expect(late.mock.calls).toEqual([["a"], ["b"]]);
  });

  describe("timeout(ms).emit before the client arrives", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("counts the ack timeout from the call, not from when the client arrives", async () => {
      const loader = deferredLoader();
      const socket = createLazySocket(loader.load);
      const ack = vi.fn();
      socket.timeout(2000).emit("latencyProbe", { clientNow: 1 }, ack);

      await vi.advanceTimersByTimeAsync(1500);
      const fake = buildFakeSocket();
      loader.arrive(fake);
      await vi.advanceTimersByTimeAsync(0);

      expect(fake.calls).toEqual([["timeoutEmit", "latencyProbe", 500, { clientNow: 1 }, ack]]);
      // Socket.IO owns the remaining 500 ms now; the facade's own timer is gone.
      await vi.advanceTimersByTimeAsync(5000);
      expect(ack).not.toHaveBeenCalled();
    });

    it("times the ack out on schedule while the client is still loading, and never sends it", async () => {
      const loader = deferredLoader();
      const socket = createLazySocket(loader.load);
      const ack = vi.fn();
      const otherAck = vi.fn();
      socket.timeout(2000).emit("latencyProbe", { clientNow: 1 }, ack);
      socket.emit("joinLot", { lotId: "l1" }, otherAck);

      await vi.advanceTimersByTimeAsync(1999);
      expect(ack).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(ack).toHaveBeenCalledTimes(1);
      expect(ack.mock.calls[0]?.[0]).toBeInstanceOf(Error);
      expect((ack.mock.calls[0]?.[0] as Error).message).toBe("operation has timed out");

      const fake = buildFakeSocket();
      loader.arrive(fake);
      await vi.advanceTimersByTimeAsync(0);
      expect(fake.calls).toEqual([["emit", "joinLot", { lotId: "l1" }, otherAck]]);
      expect(ack).toHaveBeenCalledTimes(1);
      expect(otherAck).not.toHaveBeenCalled();
    });
  });

  describe("when the client cannot be fetched", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("reports a connection error, retries, and then delivers everything in order", async () => {
      const loads: ReturnType<typeof deferredLoader>[] = [];
      const load = vi.fn(() => {
        const next = deferredLoader();
        loads.push(next);
        return next.load();
      });
      const socket = createLazySocket(load);
      const onConnectError = vi.fn();
      const onManagerError = vi.fn();
      const onReconnectAttempt = vi.fn();
      const onBid = vi.fn();
      socket.on("connect_error", onConnectError);
      socket.io.on("error", onManagerError);
      socket.io.on("reconnect_attempt", onReconnectAttempt);
      socket.on("bidUpdate", onBid);
      socket.emit("joinLot", { lotId: "l1" });

      const chunkError = new Error("Loading chunk 123 failed.");
      loads[0]?.fail(chunkError);
      await vi.advanceTimersByTimeAsync(0);

      expect(onConnectError).toHaveBeenCalledWith(chunkError);
      expect(onManagerError).toHaveBeenCalledWith(chunkError);
      expect(socket.connected).toBe(false);
      expect(load).toHaveBeenCalledTimes(1);

      // Socket.IO's first reconnection delay: 1 s with ±50% jitter.
      await vi.advanceTimersByTimeAsync(1500);
      expect(onReconnectAttempt).toHaveBeenCalledWith(1);
      expect(load).toHaveBeenCalledTimes(2);

      socket.emit("joinSaleroom", { saleId: "s1" });
      const fake = buildFakeSocket();
      loads[1]?.arrive(fake);
      await vi.advanceTimersByTimeAsync(0);

      expect(fake.calls.map((c) => `${c[0]}:${c[1]}`)).toEqual([
        "on:connect_error",
        "io.on:error",
        "io.on:reconnect_attempt",
        "on:bidUpdate",
        "emit:joinLot",
        "emit:joinSaleroom",
        // Watches for the first open, to report it as Socket.IO's `reconnect`.
        "io.on:open",
        "io.on:reconnect_attempt",
      ]);
      fake.serverEmit("bidUpdate", "x");
      expect(onBid).toHaveBeenCalledWith("x");
    });

    it("raises the same events, in the same order and with the same arguments, as Socket.IO", async () => {
      const loads: ReturnType<typeof deferredLoader>[] = [];
      const socket = createLazySocket(() => {
        const next = deferredLoader();
        loads.push(next);
        return next.load();
      });
      const heard: unknown[][] = [];
      const listen = (target: "socket" | "io", event: string) => {
        const fn = (...args: unknown[]) => heard.push([event, ...args]);
        if (target === "socket") socket.on(event, fn);
        else socket.io.on(event, fn);
      };
      listen("socket", "connect_error");
      for (const event of [
        "error",
        "reconnect_attempt",
        "reconnect_error",
        "reconnect",
        "reconnect_failed",
      ]) {
        listen("io", event);
      }

      const first = new Error("Loading chunk 1 failed.");
      const second = new Error("Loading chunk 1 failed again.");
      loads[0]?.fail(first);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(1500);
      loads[1]?.fail(second);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(3000);
      const fake = buildFakeSocket();
      loads[2]?.arrive(fake);
      await vi.advanceTimersByTimeAsync(0);

      // The client is in, but the connection is not open yet: no `reconnect` before that.
      expect(heard.map((h) => h[0])).not.toContain("reconnect");
      fake.managerEmit("open");
      fake.managerEmit("open");

      // socket.io-client 4.8 Manager: open fails → `error` (→ socket `connect_error`); a failed
      // retry adds `reconnect_error` after scheduling the next one; success → `reconnect(n)`.
      expect(heard).toEqual([
        ["error", first],
        ["connect_error", first],
        ["reconnect_attempt", 1],
        ["error", second],
        ["connect_error", second],
        ["reconnect_error", second],
        ["reconnect_attempt", 2],
        ["reconnect", 2],
      ]);
    });

    it("leaves `reconnect` to Socket.IO when the real manager has to reconnect itself", async () => {
      const loads: ReturnType<typeof deferredLoader>[] = [];
      const socket = createLazySocket(() => {
        const next = deferredLoader();
        loads.push(next);
        return next.load();
      });
      const onReconnect = vi.fn();
      socket.io.on("reconnect", onReconnect);
      loads[0]?.fail(new Error("offline"));
      await vi.advanceTimersByTimeAsync(1500);
      const fake = buildFakeSocket();
      loads[1]?.arrive(fake);
      await vi.advanceTimersByTimeAsync(0);

      fake.managerEmit("reconnect_attempt", 1);
      fake.managerEmit("open");
      expect(onReconnect).not.toHaveBeenCalled();
    });

    it("raises no `reconnect` when the first fetch succeeds", async () => {
      const loader = deferredLoader();
      const socket = createLazySocket(loader.load);
      const onReconnect = vi.fn();
      socket.io.on("reconnect", onReconnect);
      const fake = buildFakeSocket();
      loader.arrive(fake);
      await vi.advanceTimersByTimeAsync(0);
      fake.managerEmit("open");
      expect(onReconnect).not.toHaveBeenCalled();
      expect(fake.calls.map((c) => `${c[0]}:${c[1]}`)).toEqual(["io.on:reconnect"]);
    });

    it("wraps a non-Error rejection in an Error", async () => {
      const loader = deferredLoader();
      const socket = createLazySocket(loader.load);
      const onConnectError = vi.fn();
      socket.on("connect_error", onConnectError);
      loader.fail("offline");
      await vi.advanceTimersByTimeAsync(0);
      expect(onConnectError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
      expect((onConnectError.mock.calls[0]?.[0] as Error).message).toBe("offline");
    });
  });
});

describe("retryDelayMs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("matches Socket.IO's default backoff for the first retries", () => {
    // rand 0 → even → minus branch with no deviation; rand 0.99 → odd → plus 49%.
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect([0, 1, 2, 3].map(retryDelayMs)).toEqual([1000, 2000, 4000, 5000]);
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    expect(retryDelayMs(0)).toBe(1495);
  });

  it("never returns a zero, NaN or out-of-range delay, however many attempts have failed", () => {
    const randoms = [0, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99, 0.999999];
    for (let attempt = 0; attempt <= 3000; attempt += 1) {
      for (const r of randoms) {
        vi.spyOn(Math, "random").mockReturnValue(r);
        const delay = retryDelayMs(attempt);
        expect(Number.isFinite(delay), `attempt ${attempt}, random ${r}`).toBe(true);
        expect(delay).toBeGreaterThanOrEqual(500);
        expect(delay).toBeLessThanOrEqual(5000);
      }
    }
  });
});
