import { useLiveLotBid } from "@/hooks/use-live-lot-bid";
import type { ConnectionStatus } from "@/lib/realtime/contracts";
import {
  createSocketHealthAdapter,
  resetSocketHealthAdapterForTests,
} from "@/lib/realtime/socket-health-adapter";
import type { LiveSocket, SocketConnectionModule } from "@/lib/socket";
import { act, renderHook } from "@testing-library/react";
import type { Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Real callers against the real facade (`createLazySocket`) with a client that fails to load at
 * first, instead of a mocked `getSocket()`. Only the Socket.IO client itself is faked.
 */

const holder = vi.hoisted(() => ({ socket: null as LiveSocket | null }));

vi.mock("@/lib/socket", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/socket")>();
  return { ...actual, getSocket: () => holder.socket };
});

vi.mock("@/lib/time/browser-clock-sync.client", () => ({
  browserClockSync: () => ({ notifyReconnected: vi.fn(), observeServerNow: vi.fn() }),
}));

// biome-ignore lint/suspicious/noExplicitAny: Socket.IO listeners take any arguments.
type Listener = (...args: any[]) => void;

function fakeClient() {
  const listeners = new Map<string, Listener[]>();
  const managerListeners = new Map<string, Listener[]>();
  const emitted: unknown[][] = [];
  const add = (map: Map<string, Listener[]>, event: string, fn: Listener) =>
    map.set(event, [...(map.get(event) ?? []), fn]);
  const remove = (map: Map<string, Listener[]>, event: string, fn?: Listener) =>
    map.set(event, fn ? (map.get(event) ?? []).filter((l) => l !== fn) : []);
  const fire = (map: Map<string, Listener[]>, event: string, args: unknown[]) => {
    for (const fn of [...(map.get(event) ?? [])]) fn(...args);
  };
  const client = {
    connected: false,
    emitted,
    on(event: string, fn: Listener) {
      add(listeners, event, fn);
      return client;
    },
    off(event: string, fn?: Listener) {
      remove(listeners, event, fn);
      return client;
    },
    emit(event: string, ...args: unknown[]) {
      emitted.push([event, ...args]);
      return client;
    },
    timeout: () => ({
      emit: (event: string, ...args: unknown[]) => {
        emitted.push([event, ...args]);
        const ack = args.at(-1);
        if (typeof ack === "function") queueMicrotask(() => ack(null, { serverNow: Date.now() }));
        return client;
      },
    }),
    io: {
      on: (event: string, fn: Listener) => add(managerListeners, event, fn),
      off: (event: string, fn?: Listener) => remove(managerListeners, event, fn),
      emitReserved: (event: string, ...args: unknown[]) => fire(managerListeners, event, args),
    },
    server(event: string, ...args: unknown[]) {
      if (event === "connect") client.connected = true;
      fire(listeners, event, args);
    },
  };
  return client;
}

/** A loader that fails `failures` times, then hands over the client. */
function flakyLoader(failures: number, client: ReturnType<typeof fakeClient>) {
  let calls = 0;
  return vi.fn(async (): Promise<SocketConnectionModule> => {
    calls += 1;
    if (calls <= failures) throw new Error(`Loading chunk 98870 failed (${calls}).`);
    return { createSocketConnection: () => client as unknown as Socket };
  });
}

describe("live callers on the lazy socket", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    resetSocketHealthAdapterForTests();
  });
  afterEach(() => {
    vi.useRealTimers();
    holder.socket = null;
  });

  it("useLiveLotBid joins, shows pushed prices, and leaves after the client failed to load twice", async () => {
    const { createLazySocket } =
      await vi.importActual<typeof import("@/lib/socket")>("@/lib/socket");
    const client = fakeClient();
    holder.socket = createLazySocket(flakyLoader(2, client));

    const { result, unmount } = renderHook(() => useLiveLotBid("lot-1", true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(client.emitted.map((e) => e[0])).toEqual(["joinLot"]);

    act(() => {
      client.server("connect");
      client.server("bidUpdate", {
        type: "bid_placed",
        lotId: "lot-1",
        currentPrice: "1500.00",
        bid: { id: "bid-1", bidderId: "user-1", amount: "1500.00" },
      });
    });
    expect(result.current).toBe("1500.00");
    // The hook joins again on connect, as it does after any reconnection.
    expect(client.emitted.map((e) => e[0])).toEqual(["joinLot", "joinLot"]);

    unmount();
    expect(client.emitted.at(-1)?.[0]).toBe("leaveLot");
  });

  it("the health port reports a failed client fetch as it reports an unreachable server", async () => {
    const { createLazySocket } =
      await vi.importActual<typeof import("@/lib/socket")>("@/lib/socket");
    const client = fakeClient();
    holder.socket = createLazySocket(flakyLoader(3, client));

    const states: ConnectionStatus["state"][] = [];
    createSocketHealthAdapter().subscribe((s) => states.push(s.state));
    await vi.advanceTimersByTimeAsync(0);
    expect(states).toEqual(["connecting"]);

    // Three failed fetches: each retry is a `reconnect_attempt`, so the state stays "connecting"
    // (never a false "online"), and the connection notice escalates on its own clock.
    await vi.advanceTimersByTimeAsync(15_000);
    expect(new Set(states)).toEqual(new Set(["connecting"]));
    expect(states.length).toBeGreaterThanOrEqual(4);

    client.server("connect");
    await vi.advanceTimersByTimeAsync(0);
    expect(states.at(-1)).toBe("online");
  });
});
