import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type NetworkHint,
  createHealthProbe,
  createVerifiedConnectivityPort,
} from "./browser-connectivity";

function fakeHint(initiallyOnline: boolean) {
  let listener: ((online: boolean) => void) | null = null;
  const hint: NetworkHint = {
    isOnline: () => initiallyOnline,
    subscribe(next) {
      listener = next;
      return () => {
        listener = null;
      };
    },
  };
  return { hint, emit: (online: boolean) => listener?.(online) };
}

function setup(initiallyOnline: boolean, reachable: () => boolean) {
  const { hint, emit } = fakeHint(initiallyOnline);
  const probe = vi.fn(async () => reachable());
  const port = createVerifiedConnectivityPort({
    hint,
    probe,
    debounceMs: 2_500,
    retryDelaysMs: [5_000, 10_000],
  });
  const seen: boolean[] = [];
  const unsubscribe = port.subscribe((online) => seen.push(online));
  return { port, probe, emit, seen, unsubscribe };
}

describe("createVerifiedConnectivityPort", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("stays online when the browser wrongly reports offline and the server answers", async () => {
    const { port, probe, seen } = setup(false, () => true);
    expect(port.isOnline()).toBe(true);
    await vi.advanceTimersByTimeAsync(2_499);
    expect(probe).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(probe).toHaveBeenCalledTimes(1);
    expect(port.isOnline()).toBe(true);
    expect(seen).toEqual([]);
    // No polling once the false alarm is cleared.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it("shows offline only after the check fails, then checks again with growing gaps", async () => {
    let up = true;
    const { port, probe, emit, seen } = setup(true, () => up);
    up = false;
    emit(false);
    await vi.advanceTimersByTimeAsync(2_500);
    expect(port.isOnline()).toBe(false);
    expect(seen).toEqual([false]);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(probe).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(9_999);
    expect(probe).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(probe).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(probe).toHaveBeenCalledTimes(4);
  });

  it("recovers on the next successful check even when no online event arrives", async () => {
    let up = false;
    const { port, emit, seen } = setup(true, () => up);
    emit(false);
    await vi.advanceTimersByTimeAsync(2_500);
    expect(port.isOnline()).toBe(false);
    up = true;
    await vi.advanceTimersByTimeAsync(5_000);
    expect(port.isOnline()).toBe(true);
    expect(seen).toEqual([false, true]);
  });

  it("checks at once on an online event and clears when the server answers", async () => {
    let up = false;
    const { port, emit } = setup(true, () => up);
    emit(false);
    await vi.advanceTimersByTimeAsync(2_500);
    expect(port.isOnline()).toBe(false);
    up = true;
    emit(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(port.isOnline()).toBe(true);
  });

  it("stops checking when nothing listens", async () => {
    const { probe, unsubscribe } = setup(false, () => false);
    unsubscribe();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(probe).not.toHaveBeenCalled();
  });
});

describe("createHealthProbe", () => {
  it("asks our health route without caching", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}"));
    await expect(createHealthProbe(fetchImpl)()).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/health",
      expect.objectContaining({ cache: "no-store", method: "GET" }),
    );
  });

  it("reports unreachable when the request fails", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(createHealthProbe(fetchImpl)()).resolves.toBe(false);
  });
});
