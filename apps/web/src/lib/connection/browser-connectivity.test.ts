import {
  type ConnectivityHints,
  createBrowserConnectivityPort,
} from "@/lib/connection/browser-connectivity";
import { createHttpConnectivityProbe } from "@/lib/connection/connectivity-probe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = () => void;

function fakeHints(initiallyOnline: boolean) {
  const handlers: Record<"online" | "offline", Set<Handler>> = {
    online: new Set(),
    offline: new Set(),
  };
  let reportsOnline = initiallyOnline;
  const hints: ConnectivityHints = {
    reportsOnline: () => reportsOnline,
    addEventListener: (type, handler) => handlers[type].add(handler),
    removeEventListener: (type, handler) => handlers[type].delete(handler),
  };
  const fire = (type: "online" | "offline") => {
    reportsOnline = type === "online";
    for (const handler of handlers[type]) handler();
  };
  return { hints, fire, handlers };
}

function setup(initiallyOnline: boolean, reachable: boolean) {
  const { hints, fire, handlers } = fakeHints(initiallyOnline);
  const probe = vi.fn(async () => reachable);
  const port = createBrowserConnectivityPort({
    probe,
    hints,
    confirmDelayMs: 2_500,
    initialRetryDelayMs: 5_000,
    maxRetryDelayMs: 20_000,
  });
  const states: boolean[] = [];
  const unsubscribe = port.subscribe((online) => states.push(online));
  return { port, probe, fire, handlers, states, unsubscribe };
}

describe("createBrowserConnectivityPort", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays online when the browser says offline but the probe succeeds", async () => {
    const { port, probe, states } = setup(false, true);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(probe).toHaveBeenCalledTimes(1);
    expect(port.isOnline()).toBe(true);
    expect(states).toEqual([]);
  });

  it("goes offline only after the debounce when the probe fails", async () => {
    const { port, probe, fire, states } = setup(true, false);
    fire("offline");
    await vi.advanceTimersByTimeAsync(2_000);
    expect(probe).not.toHaveBeenCalled();
    expect(port.isOnline()).toBe(true);
    await vi.advanceTimersByTimeAsync(600);
    expect(probe).toHaveBeenCalledTimes(1);
    expect(port.isOnline()).toBe(false);
    expect(states).toEqual([false]);
  });

  it("re-probes with backoff while offline and recovers on a successful probe", async () => {
    const { port, probe, fire, states } = setup(true, false);
    fire("offline");
    await vi.advanceTimersByTimeAsync(2_500);
    expect(port.isOnline()).toBe(false);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(probe).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(9_999);
    expect(probe).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(probe).toHaveBeenCalledTimes(3);

    probe.mockResolvedValue(true);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(port.isOnline()).toBe(true);
    expect(states).toEqual([false, true]);
  });

  it("clears the offline state on an online event", async () => {
    const { port, probe, fire, states } = setup(true, false);
    fire("offline");
    await vi.advanceTimersByTimeAsync(2_500);
    expect(port.isOnline()).toBe(false);
    fire("online");
    expect(port.isOnline()).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(probe).toHaveBeenCalledTimes(1);
    expect(states).toEqual([false, true]);
  });

  it("never flashes offline on a brief blip", async () => {
    const { port, probe, fire, states } = setup(true, false);
    fire("offline");
    await vi.advanceTimersByTimeAsync(1_000);
    fire("online");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(probe).not.toHaveBeenCalled();
    expect(port.isOnline()).toBe(true);
    expect(states).toEqual([]);
  });

  it("stops listening and probing once the last subscriber leaves", async () => {
    const { probe, fire, handlers, unsubscribe } = setup(true, false);
    fire("offline");
    unsubscribe();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(probe).not.toHaveBeenCalled();
    expect(handlers.online.size).toBe(0);
    expect(handlers.offline.size).toBe(0);
  });
});

describe("createHttpConnectivityProbe", () => {
  it("treats any response as reachable and sends an uncached same-origin HEAD", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 503 }));
    const probe = createHttpConnectivityProbe({ fetchImpl });
    await expect(probe()).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/health",
      expect.objectContaining({ method: "HEAD", cache: "no-store" }),
    );
  });

  it("treats a network error as unreachable", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const probe = createHttpConnectivityProbe({ fetchImpl });
    await expect(probe()).resolves.toBe(false);
  });
});
