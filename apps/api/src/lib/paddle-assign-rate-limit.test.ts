import { describe, expect, it, vi } from "vitest";
import { checkPaddleAssignRateLimit } from "./paddle-assign-rate-limit.js";

function buildFakeRedis(counts: number[]) {
  let i = 0;
  return {
    incr: vi.fn(async () => counts[i++] ?? counts.at(-1) ?? 1),
    expire: vi.fn(async () => 1),
  };
}

describe("checkPaddleAssignRateLimit", () => {
  it("allows requests under the cap", async () => {
    const allowed = await checkPaddleAssignRateLimit(buildFakeRedis([1]) as never, "clerk-1");
    expect(allowed).toBe(true);
  });

  it("blocks requests over the cap", async () => {
    const allowed = await checkPaddleAssignRateLimit(buildFakeRedis([61]) as never, "clerk-1");
    expect(allowed).toBe(false);
  });
});
