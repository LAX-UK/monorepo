import { describe, expect, it } from "vitest";
import { createInMemoryFixedWindowCounter } from "./in-memory-fixed-window-counter.js";

describe("createInMemoryFixedWindowCounter", () => {
  it("counts within a window and starts again once it expires", async () => {
    let now = 1_000_000;
    const counter = createInMemoryFixedWindowCounter(() => now);
    await expect(counter.increment("k", 60)).resolves.toEqual({ count: 1, resetInSeconds: 60 });
    now += 30_000;
    await expect(counter.increment("k", 60)).resolves.toEqual({ count: 2, resetInSeconds: 30 });
    now += 30_000;
    await expect(counter.increment("k", 60)).resolves.toEqual({ count: 1, resetInSeconds: 60 });
  });
});
