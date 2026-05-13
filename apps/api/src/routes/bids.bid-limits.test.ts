import { Hono } from "hono";
import type { Redis } from "ioredis";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createBidRoutes } from "./bids.js";

const lotId = "550e8400-e29b-41d4-a716-446655440000";

/** Minimal in-memory Redis for rate-limit counters. */
class MemoryRedis {
  private counts = new Map<string, number>();
  private exp = new Map<string, number>();

  async incr(key: string): Promise<number> {
    const n = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, n);
    return n;
  }

  async expire(key: string, seconds: number): Promise<number> {
    this.exp.set(key, Date.now() + seconds * 1000);
    return 1;
  }

  async pttl(key: string): Promise<number> {
    const e = this.exp.get(key);
    if (!e) return 60_000;
    return Math.max(1, e - Date.now());
  }

  async get(_key: string): Promise<string | null> {
    return null;
  }

  async set(_key: string, _val: string, ..._args: unknown[]): Promise<unknown> {
    return "OK";
  }
}

function mount() {
  const redis = new MemoryRedis() as unknown as Redis;
  const bidService = {
    placeBidWithIdempotency: vi.fn().mockResolvedValue({
      type: "ok",
      body: {
        data: {
          id: "bid-1",
          lotId,
          amount: "100",
          isWinning: true,
          isAutoBid: false,
          maxAutoBidAmount: null,
          createdAt: new Date(),
        },
      },
    }),
  };
  const container = {
    env: {},
    redis,
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    kycService: { isConfigured: () => false },
    bidService,
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue({ id: "user-rate-test", role: "client" }),
  };
  const app = new Hono();
  app.route("/bids", createBidRoutes(container, authenticator));
  return { app, bidService };
}

function bidBody() {
  return JSON.stringify({ lotId, amount: 100 });
}

describe("bid user rate limits", () => {
  it("returns 429 with Retry-After after 30 bids in one minute for the same user", async () => {
    const { app, bidService } = mount();
    for (let i = 0; i < 30; i++) {
      const res = await app.request("/bids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bidBody(),
      });
      expect(res.status).toBe(201);
    }
    const blocked = await app.request("/bids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bidBody(),
    });
    expect(blocked.status).toBe(429);
    const ra = blocked.headers.get("Retry-After");
    expect(ra).toBeTruthy();
    expect(Number(ra)).toBeGreaterThanOrEqual(1);
    const json = (await blocked.json()) as { code?: string };
    expect(json.code).toBe("bid_rate_limited_minute");
    expect(bidService.placeBidWithIdempotency).toHaveBeenCalledTimes(30);
  });
});

describe("POST /bids success contract", () => {
  it("returns top-level data key with bid id", async () => {
    const redis = new MemoryRedis() as unknown as Redis;
    const bidService = {
      placeBidWithIdempotency: vi.fn().mockResolvedValue({
        type: "ok",
        body: {
          data: {
            id: "bid-contract",
            lotId,
            amount: "10.00",
            isWinning: true,
            isAutoBid: false,
            maxAutoBidAmount: null,
            createdAt: new Date(),
          },
        },
      }),
    };
    const container = {
      env: {},
      redis,
      userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
      kycService: { isConfigured: () => false },
      bidService,
    } as unknown as Container;
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({ id: "u-contract", role: "client" }),
    };
    const app = new Hono();
    app.route("/bids", createBidRoutes(container, authenticator));
    const res = await app.request("/bids", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lotId, amount: 10 }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { id: string } };
    expect(Object.keys(body).sort()).toEqual(["data"]);
    expect(body.data.id).toBe("bid-contract");
  });
});
