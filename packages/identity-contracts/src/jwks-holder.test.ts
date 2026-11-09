import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DISCOVERY_CACHE_TTL_MS,
  JWKS_MAX_STALE_MS,
  createJwksHolder,
  jwksHolderFor,
} from "./jwks-holder.js";

const jwk = (kid: string) => ({ kty: "RSA", kid, alg: "RS256", use: "sig", n: "AQAB", e: "AQAB" });

let clock: number;
let published: string[];
let fetchCalls: number;
let healthy: boolean;

const fetchImpl = vi.fn(async () => {
  fetchCalls++;
  if (!healthy) return new Response("down", { status: 503 });
  return new Response(JSON.stringify({ keys: published.map(jwk) }), { status: 200 });
});

const holder = () =>
  createJwksHolder({ url: "https://auth.test/jwks", fetchImpl, now: () => clock });

beforeEach(() => {
  clock = 1_000_000;
  published = ["a"];
  fetchCalls = 0;
  healthy = true;
  fetchImpl.mockClear();
});
afterEach(() => vi.restoreAllMocks());

describe("createJwksHolder", () => {
  it("refreshes about once a minute, not on every call", async () => {
    const h = holder();
    for (let i = 0; i < 5; i++) await h.getKey({ alg: "RS256", kid: "a" });
    expect(fetchCalls).toBe(1);
    clock += DISCOVERY_CACHE_TTL_MS;
    await h.getKey({ alg: "RS256", kid: "a" });
    expect(fetchCalls).toBe(2);
  });

  it("shares one fetch between concurrent first callers", async () => {
    const h = holder();
    await Promise.all(Array.from({ length: 8 }, () => h.getKey({ alg: "RS256", kid: "a" })));
    expect(fetchCalls).toBe(1);
  });

  it("does not retry a failing issuer inside the cooldown, and fails closed with no earlier set", async () => {
    healthy = false;
    const h = holder();
    for (let i = 0; i < 5; i++) {
      await expect(h.getKey({ alg: "RS256", kid: "a" })).rejects.toThrow();
    }
    expect(fetchCalls).toBe(1);
  });

  it("serves a stale set after a failed refresh, then drops it past the maximum staleness", async () => {
    const h = holder();
    await h.getKey({ alg: "RS256", kid: "a" });
    healthy = false;
    clock += DISCOVERY_CACHE_TTL_MS + 1;
    await expect(h.getKey({ alg: "RS256", kid: "a" })).resolves.toBeDefined();
    clock += JWKS_MAX_STALE_MS;
    await expect(h.getKey({ alg: "RS256", kid: "a" })).rejects.toThrow();
  });

  it("never adds keys from a failed fetch and remembers keys it has seen", async () => {
    const h = holder();
    await h.getKey({ alg: "RS256", kid: "a" });
    expect(h.hasSeen("a")).toBe(true);
    expect(h.hasSeen("b")).toBe(false);
    published = ["a", "b"];
    healthy = false;
    clock += DISCOVERY_CACHE_TTL_MS + 1;
    await expect(h.getKey({ alg: "RS256", kid: "b" })).rejects.toThrow();
    expect(h.hasSeen("b")).toBe(false);
  });

  it("serves a set up to two intervals old while refreshing behind the request", async () => {
    const h = holder();
    await h.getKey({ alg: "RS256", kid: "a" });
    clock += DISCOVERY_CACHE_TTL_MS + 1;
    published = ["a", "b"];
    await h.getKey({ alg: "RS256", kid: "a" });
    expect(fetchCalls).toBe(2); // the refresh started
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(h.hasSeen("b")).toBe(true);
  });

  it("does not follow a redirect for the key set", async () => {
    const seen: RequestInit[] = [];
    const h = createJwksHolder({
      url: "https://auth.test/jwks",
      now: () => clock,
      fetchImpl: (async (_url: unknown, init: RequestInit) => {
        seen.push(init);
        return new Response(null, { status: 302, headers: { location: "https://elsewhere.test" } });
      }) as unknown as typeof fetch,
      onFetchFailure: () => undefined,
    });
    await expect(h.getKey({ alg: "RS256", kid: "a" })).rejects.toThrow();
    expect(seen[0]?.redirect).toBe("manual");
  });

  it("reports a failed fetch", async () => {
    healthy = false;
    const onFetchFailure = vi.fn();
    const h = createJwksHolder({
      url: "https://auth.test/jwks",
      fetchImpl,
      now: () => clock,
      onFetchFailure,
    });
    await expect(h.getKey({ alg: "RS256", kid: "a" })).rejects.toThrow();
    expect(onFetchFailure).toHaveBeenCalledWith({
      url: "https://auth.test/jwks",
      reason: expect.stringContaining("503"),
    });
  });

  it("shares one holder per URL", () => {
    expect(jwksHolderFor("https://auth.test/x")).toBe(jwksHolderFor("https://auth.test/x"));
  });
});
