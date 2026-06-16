import { describe, expect, it } from "vitest";
import {
  computeSlidingWindowRetryAfterSec,
  oldestBlockingScoreMs,
} from "./sliding-window-rate-limit.js";

describe("computeSlidingWindowRetryAfterSec", () => {
  it("returns seconds until the blocking entry expires", () => {
    const now = 1_000_000;
    const windowSec = 900;
    const oldest = now - 600_000;
    expect(
      computeSlidingWindowRetryAfterSec({
        oldestBlockingScoreMs: oldest,
        windowSec,
        nowMs: now,
      }),
    ).toBe(300);
  });

  it("never returns less than 1", () => {
    expect(
      computeSlidingWindowRetryAfterSec({
        oldestBlockingScoreMs: Date.now(),
        windowSec: 60,
        nowMs: Date.now() + 60_000,
      }),
    ).toBe(1);
  });
});

describe("oldestBlockingScoreMs", () => {
  it("targets rank `excess` so the next retry actually succeeds", async () => {
    // count=6, max=5 → excess=1. Two entries must expire before survivors
    // drop to 4 and a re-adding request is allowed, i.e. the entry at rank 1.
    const redis = {
      zrange: async (_key: string, start: number, stop: number) => {
        expect(start).toBe(1);
        expect(stop).toBe(1);
        return ["member", "5000"];
      },
    };
    await expect(oldestBlockingScoreMs(redis, "k", 6, 5)).resolves.toBe(5000);
  });

  it("scales the rank with how far over the limit we are", async () => {
    const redis = {
      zrange: async (_key: string, start: number) => {
        expect(start).toBe(5);
        return ["member", "9000"];
      },
    };
    await expect(oldestBlockingScoreMs(redis, "k", 10, 5)).resolves.toBe(9000);
  });

  it("returns null when under limit", async () => {
    const redis = { zrange: async () => [] as string[] };
    await expect(oldestBlockingScoreMs(redis, "k", 5, 5)).resolves.toBeNull();
  });

  it("returns null when the rank is missing from the set", async () => {
    const redis = { zrange: async () => [] as string[] };
    await expect(oldestBlockingScoreMs(redis, "k", 6, 5)).resolves.toBeNull();
  });
});
