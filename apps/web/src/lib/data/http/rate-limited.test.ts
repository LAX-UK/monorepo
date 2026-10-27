import { describe, expect, it } from "vitest";
import { RateLimitedError, mapInChunks, rateLimitedFrom } from "./rate-limited";

describe("rateLimitedFrom", () => {
  it("reads the Retry-After hint in seconds", () => {
    const res = new Response(null, { status: 429, headers: { "retry-after": "12" } });
    expect(rateLimitedFrom(res).retryAfterMs).toBe(12_000);
  });

  it("has no hint when the header is missing or invalid", () => {
    expect(rateLimitedFrom(new Response(null, { status: 429 })).retryAfterMs).toBeNull();
    const invalid = new Response(null, { headers: { "retry-after": "soon" } });
    expect(rateLimitedFrom(invalid).retryAfterMs).toBeNull();
    expect(rateLimitedFrom(new Response(null))).toBeInstanceOf(RateLimitedError);
  });
});

describe("mapInChunks", () => {
  it("keeps results in order and never exceeds the chunk size in flight", async () => {
    let inFlight = 0;
    let peak = 0;
    const result = await mapInChunks([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      return n * 2;
    });
    expect(result).toEqual([2, 4, 6, 8, 10, 12, 14]);
    expect(peak).toBe(3);
  });
});
