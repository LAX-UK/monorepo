import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { Redis } from "ioredis";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { KycRequiredError } from "../services/interfaces/kyc-service.js";
import { createBidRoutes } from "./bids.js";

const lotId = "550e8400-e29b-41d4-a716-446655440000";
const personalEntityId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function stubLegalEntityMiddleware(entityId = personalEntityId) {
  return createMiddleware(async (c, next) => {
    c.set("legalEntityContext", {
      legalEntityId: entityId,
      userId: c.get("userId") as string,
      role: "owner",
      isPrimaryAdmin: true,
    });
    await next();
  });
}

/** Minimal in-memory Redis for rate-limit counters and idempotency. */
class MemoryRedis {
  private counts = new Map<string, number>();
  private exp = new Map<string, number>();
  private values = new Map<string, string>();

  presetCount(key: string, value: number): void {
    this.counts.set(key, value);
  }

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

  async script(command: string, _lua?: string): Promise<string> {
    if (String(command).toUpperCase() === "LOAD") return "memory-sha";
    throw new Error(`unsupported script ${command}`);
  }

  async evalsha(
    _sha: string,
    numKeys: number,
    key: string,
    limit: string,
    windowSec: string,
  ): Promise<[number, number]> {
    if (numKeys !== 1) throw new Error("expected 1 key");
    const current = await this.incr(key);
    let ttl = this.ttlSeconds(key);
    if (current === 1 || ttl < 0) {
      await this.expire(key, Number(windowSec));
      ttl = Number(windowSec);
    }
    if (current > Number(limit)) {
      return [0, this.ttlSeconds(key)];
    }
    return [1, Number(limit) - current];
  }

  private ttlSeconds(key: string): number {
    const e = this.exp.get(key);
    if (!e) return -1;
    return Math.max(-1, Math.ceil((e - Date.now()) / 1000));
  }

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async set(_key: string, _val: string, ..._args: unknown[]): Promise<unknown> {
    return "OK";
  }

  async tryClaim(key: string, _ttlSeconds: number): Promise<boolean> {
    if (this.values.has(key)) return false;
    this.values.set(key, "__pending__");
    return true;
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }

  async setWithExpiry(key: string, value: string, _ttlSeconds: number): Promise<void> {
    this.values.set(key, value);
  }
}

function mount(opts?: {
  env?: Container["env"];
  kycService?: Container["kycService"];
  placeBid?: ReturnType<typeof vi.fn>;
  userId?: string;
  redis?: MemoryRedis;
}) {
  const redis = (opts?.redis ?? new MemoryRedis()) as unknown as Redis;
  const placeBid =
    opts?.placeBid ??
    vi.fn().mockResolvedValue({
      kind: "ok",
      data: {
        id: "bid-1",
        lotId,
        amount: "100",
        isWinning: true,
        isAutoBid: false,
        maxAutoBidAmount: null,
        createdAt: new Date(),
      },
      status: 201,
    });
  const container = {
    env: opts?.env ?? {},
    redis,
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    kycService: opts?.kycService ?? { isConfigured: () => false },
    bidding: {
      placeBidHttp: { placeBid },
      autoBidHttp: {},
      absenteeBidHttp: {},
      saleRegistrationHttp: {},
      lotBidHistoryHttp: {},
      conditionReportHttp: {},
    },
    requireSubmissionsLegalEntityContext: stubLegalEntityMiddleware(),
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue({
      id: opts?.userId ?? "user-rate-test",
      role: "client",
      scopes: ["bid.write"],
    }),
  };
  const app = new Hono();
  app.route("/bids", createBidRoutes(container, authenticator));
  return { app, placeBid, redis };
}

function bidBody() {
  return JSON.stringify({ lotId, amount: 100 });
}

describe("bid user rate limits", () => {
  it("returns 429 with Retry-After after 30 bids in one minute for the same user", async () => {
    const { app, placeBid } = mount();
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
    expect(placeBid).toHaveBeenCalledTimes(30);
  });

  it("returns 429 with bid_rate_limited_hour after 100 bids in one hour", async () => {
    const redis = new MemoryRedis();
    redis.presetCount("bid:rl:1h:user-hour-test", 100);
    const { app, placeBid } = mount({ userId: "user-hour-test", redis });
    const blocked = await app.request("/bids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bidBody(),
    });
    expect(blocked.status).toBe(429);
    const json = (await blocked.json()) as { code?: string };
    expect(json.code).toBe("bid_rate_limited_hour");
    expect(placeBid).not.toHaveBeenCalled();
  });
});

describe("POST /bids middleware gates", () => {
  it("returns 503 when DISABLE_BIDDING kill switch is on", async () => {
    const { app, placeBid } = mount({ env: { DISABLE_BIDDING: true } as Container["env"] });
    const res = await app.request("/bids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bidBody(),
    });
    expect(res.status).toBe(503);
    const json = (await res.json()) as { code?: string };
    expect(json.code).toBe("bidding_disabled");
    expect(placeBid).not.toHaveBeenCalled();
  });

  it("returns 402 kyc_required when KYC middleware rejects", async () => {
    const { app, placeBid } = mount({
      kycService: {
        isConfigured: () => true,
        enforceThreshold: vi.fn().mockRejectedValue(
          new KycRequiredError({
            status: "unverified",
            verifiedAt: null,
            latestSessionId: null,
            latestSessionStatus: null,
            feedback: {
              headline: "Verification required",
              detail: null,
              action: "start",
              reasonCode: null,
              decisionStatus: null,
              needsResubmit: false,
            },
            pendingExposure: { total: 2000, currency: "GBP" },
            thresholdAmount: 1000,
            thresholdCurrency: "GBP",
            requiresKyc: true,
          }),
        ),
      } as unknown as Container["kycService"],
    });
    const res = await app.request("/bids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bidBody(),
    });
    expect(res.status).toBe(402);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toBe("kyc_required");
    expect(placeBid).not.toHaveBeenCalled();
  });

  it("defers to the runtime eligibility result when strict eligibility is enabled", async () => {
    const enforceThreshold = vi.fn();
    const { app } = mount({
      env: {
        APP_ENV: "test",
        STRICT_BID_ELIGIBILITY_ENABLED: true,
      } as Container["env"],
      kycService: {
        isConfigured: () => true,
        enforceThreshold,
      } as unknown as Container["kycService"],
      placeBid: vi.fn().mockResolvedValue({
        kind: "err",
        error: {
          message: "Verify your email before bidding",
          status: 403,
          code: "email_not_verified",
        },
      }),
    });

    const res = await app.request("/bids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bidBody(),
    });

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "email_not_verified" });
    expect(enforceThreshold).not.toHaveBeenCalled();
  });

  it("returns eligibility error code from bid service", async () => {
    const { app } = mount({
      placeBid: vi.fn().mockResolvedValue({
        kind: "err",
        error: {
          message: "Register and be approved to bid on this sale",
          status: 403,
          code: "sale_registration_required",
        },
      }),
    });
    const res = await app.request("/bids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bidBody(),
    });
    expect(res.status).toBe(403);
    const json = (await res.json()) as { error?: string; code?: string };
    expect(json.code).toBe("sale_registration_required");
  });

  it("passes acting legal entity id from middleware to bid service", async () => {
    const agentEntityId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const placeBid = vi.fn().mockResolvedValue({
      kind: "ok",
      data: { id: "bid-agent", lotId, amount: "100" },
      status: 201,
    });
    const container = {
      env: {},
      redis: new MemoryRedis() as unknown as Redis,
      userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
      kycService: { isConfigured: () => false },
      bidding: {
        placeBidHttp: { placeBid },
        autoBidHttp: {},
        absenteeBidHttp: {},
        saleRegistrationHttp: {},
        lotBidHistoryHttp: {},
        conditionReportHttp: {},
      },
      requireSubmissionsLegalEntityContext: stubLegalEntityMiddleware(agentEntityId),
    } as unknown as Container;
    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: "agent-user", role: "client", scopes: ["bid.write"] }),
    };
    const app = new Hono();
    app.route("/bids", createBidRoutes(container, authenticator));
    const res = await app.request("/bids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bidBody(),
    });
    expect(res.status).toBe(201);
    expect(placeBid).toHaveBeenCalledWith(
      expect.objectContaining({
        buyerLegalEntityId: agentEntityId,
      }),
    );
  });
});

describe("POST /bids success contract", () => {
  it("returns top-level data key with bid id", async () => {
    const redis = new MemoryRedis() as unknown as Redis;
    const placeBid = vi.fn().mockResolvedValue({
      kind: "ok",
      data: {
        id: "bid-contract",
        lotId,
        amount: "10.00",
        isWinning: true,
        isAutoBid: false,
        maxAutoBidAmount: null,
        createdAt: new Date(),
      },
      status: 201,
    });
    const container = {
      env: {},
      redis,
      userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
      kycService: { isConfigured: () => false },
      bidding: {
        placeBidHttp: { placeBid },
        autoBidHttp: {},
        absenteeBidHttp: {},
        saleRegistrationHttp: {},
        lotBidHistoryHttp: {},
        conditionReportHttp: {},
      },
      requireSubmissionsLegalEntityContext: stubLegalEntityMiddleware(),
    } as unknown as Container;
    const authenticator: IAuthenticator = {
      getSessionUser: vi
        .fn()
        .mockResolvedValue({ id: "u-contract", role: "client", scopes: ["bid.write"] }),
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
