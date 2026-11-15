import { describe, expect, it, vi } from "vitest";

const mockedCounters = vi.hoisted(() => ({
  current: {
    "https://auth.one.test/.well-known/jwks.json": { fetchFailures: 2, staleServes: 5 },
    "https://auth.two.test/.well-known/jwks.json": { fetchFailures: 1, staleServes: 0 },
  } as Record<string, { fetchFailures: number; staleServes: number }>,
}));

vi.mock("@auction/identity-contracts", () => ({
  sharedJwksCounters: () => mockedCounters.current,
}));

const { jwksEventTotals, renderMetrics } = await import("./metrics.js");

describe("JWKS metrics", () => {
  it("sums the shared holders' totals across issuers", () => {
    expect(jwksEventTotals()).toEqual({ fetch_failed: 3, served_stale: 5 });
  });

  it("exports them without the issuer URLs", async () => {
    const text = await renderMetrics();
    expect(text).toContain('auction_api_jwks_events_total{event="fetch_failed"} 3');
    expect(text).toContain('auction_api_jwks_events_total{event="served_stale"} 5');
    expect(text).not.toContain("auth.one.test");
  });

  it("exports current totals on every scrape, not a sum across scrapes", async () => {
    const original = mockedCounters.current;
    try {
      await renderMetrics();
      mockedCounters.current = {
        "https://auth.one.test/.well-known/jwks.json": { fetchFailures: 4, staleServes: 6 },
      };
      const second = await renderMetrics();
      expect(second).toContain('auction_api_jwks_events_total{event="fetch_failed"} 4');
      expect(second).toContain('auction_api_jwks_events_total{event="served_stale"} 6');
      mockedCounters.current = {
        "https://auth.one.test/.well-known/jwks.json": { fetchFailures: 4, staleServes: 7 },
      };
      const third = await renderMetrics();
      expect(third).toContain('auction_api_jwks_events_total{event="fetch_failed"} 4');
      expect(third).toContain('auction_api_jwks_events_total{event="served_stale"} 7');
    } finally {
      mockedCounters.current = original;
    }
  });
});
