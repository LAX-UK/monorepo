import { describe, expect, it, vi } from "vitest";
import type { IRateLimitStore } from "../services/interfaces/rate-limit-store.js";
import { createServerTimeRoutes } from "./server-time.js";

const allow: IRateLimitStore = { increment: vi.fn(async () => ({ allowed: true, remaining: 29 })) };

describe("GET /time", () => {
  it("answers the server's time in milliseconds and is never cached", async () => {
    const app = createServerTimeRoutes({
      rateLimitStore: allow,
      clock: { now: () => 1_700_000_000_123 },
    });
    const res = await app.request("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ serverNowMs: 1_700_000_000_123 });
  });

  it("needs no sign-in", async () => {
    const app = createServerTimeRoutes({ rateLimitStore: allow });
    const res = await app.request("/");
    expect(res.status).toBe(200);
  });

  it("refuses with retry-after when a client is over its allowance", async () => {
    const deny: IRateLimitStore = {
      increment: vi.fn(async () => ({ allowed: false, remaining: 0, retryAfterSec: 12 })),
    };
    const res = await createServerTimeRoutes({ rateLimitStore: deny }).request("/");
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("12");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("still answers when the counter is unavailable", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const broken: IRateLimitStore = {
      increment: vi.fn(async () => {
        throw new Error("redis down");
      }),
    };
    const res = await createServerTimeRoutes({ rateLimitStore: broken }).request("/");
    expect(res.status).toBe(200);
  });
});
