import { randomInt } from "node:crypto";
import { ZohoBooksClient, type ZohoBooksConfig } from "@auction/accounting-zoho-books";
import {
  FakeZohoTransport,
  InMemoryTokenStore,
  TEST_REFRESH_TOKEN,
  isApiRequest,
  isTokenRequest,
  testConfig,
  tokenReply,
  zohoOkReply,
} from "@auction/accounting-zoho-books/testing";
import { Redis } from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { redisZohoBooksLimits } from "./redis-zoho-books-limits.js";

const redisUrl = process.env.REDIS_URL;

/**
 * Two clients, each with its own Redis connection, stand for two worker replicas. They share one
 * token store and one (fake) Zoho; only the limits live in Redis.
 */
describe.skipIf(!redisUrl)("Zoho Books limits shared through Redis (integration)", () => {
  const connections: Redis[] = [];

  function connect(): Redis {
    const redis = new Redis(redisUrl as string, { maxRetriesPerRequest: 1 });
    connections.push(redis);
    return redis;
  }

  /** A fresh organisation per test, so keys never collide with another run. */
  const organisation = () => `9${Date.now()}${randomInt(1_000_000)}`;

  function twoReplicas(overrides: Partial<ZohoBooksConfig>) {
    const config = testConfig({ maxQueueWaitMs: 0, ...overrides });
    const transport = new FakeZohoTransport();
    const store = new InMemoryTokenStore();
    const replica = (redis: Redis) =>
      new ZohoBooksClient({
        config,
        transport,
        tokenStore: store,
        ...redisZohoBooksLimits(redis, config),
      });
    return { a: replica(connect()), b: replica(connect()), transport, store };
  }

  beforeAll(async () => {
    await connect().ping();
  });

  afterAll(async () => {
    await Promise.all(connections.map((redis) => redis.quit().catch(() => undefined)));
  });

  it("two replicas together send no more than the per-minute limit", async () => {
    const org = organisation();
    const { a, b, transport } = twoReplicas({ ratePerMinute: 3 });
    await a.registerRefreshToken(org, TEST_REFRESH_TOKEN);
    transport.enqueue(tokenReply("access-1"), isTokenRequest);
    for (let i = 0; i < 8; i++) transport.enqueue(zohoOkReply(), isApiRequest);

    const results = await Promise.all(
      [0, 1, 2, 3].flatMap(() => [a.get(org, "/invoices"), b.get(org, "/invoices")]),
    );

    expect(transport.requests.filter(isApiRequest)).toHaveLength(3);
    const refused = results.filter((r) => !r.ok);
    expect(refused).toHaveLength(5);
    for (const r of refused) if (!r.ok) expect(r.error.kind).toBe("rate_limited");
  });

  it("two replicas share one daily budget", async () => {
    const org = organisation();
    const { a, b, transport } = twoReplicas({ dailyCallBudget: 3 });
    await a.registerRefreshToken(org, TEST_REFRESH_TOKEN);
    transport.enqueue(tokenReply("access-1"), isTokenRequest);
    for (let i = 0; i < 4; i++) transport.enqueue(zohoOkReply(), isApiRequest);

    const results = await Promise.all([
      a.get(org, "/invoices"),
      b.get(org, "/invoices"),
      a.get(org, "/invoices"),
      b.get(org, "/invoices"),
    ]);

    expect(transport.requests.filter(isApiRequest)).toHaveLength(3);
    expect(results.filter((r) => !r.ok && r.error.kind === "budget_exhausted")).toHaveLength(1);
  });

  it("two replicas that need a token at once make one refresh", async () => {
    const org = organisation();
    const { a, b, transport, store } = twoReplicas({});
    await a.registerRefreshToken(org, TEST_REFRESH_TOKEN);
    // A slow token endpoint: the second replica asks while the first refresh is still in flight.
    transport.enqueue(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return tokenReply("access-1");
    }, isTokenRequest);
    transport.enqueue(zohoOkReply(), isApiRequest).enqueue(zohoOkReply(), isApiRequest);

    const results = await Promise.all([a.get(org, "/invoices"), b.get(org, "/invoices")]);

    expect(results.every((r) => r.ok)).toBe(true);
    expect(transport.requests.filter(isTokenRequest)).toHaveLength(1);
    expect(store.saves).toBe(1);
    for (const request of transport.requests.filter(isApiRequest)) {
      expect(request.headers.authorization).toBe("Zoho-oauthtoken access-1");
    }
  });

  it("sends nothing when Redis cannot be reached", async () => {
    const org = organisation();
    const config = testConfig({ maxQueueWaitMs: 0 });
    const transport = new FakeZohoTransport();
    const store = new InMemoryTokenStore();
    const down = new Redis("redis://127.0.0.1:1", {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    });
    down.on("error", () => undefined);
    connections.push(down);
    const client = new ZohoBooksClient({
      config,
      transport,
      tokenStore: store,
      ...redisZohoBooksLimits(down, config),
    });
    await client.registerRefreshToken(org, TEST_REFRESH_TOKEN);

    const result = await client.get(org, "/invoices");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("rate_window_unavailable");
    expect(transport.requests).toHaveLength(0);
  });
});
