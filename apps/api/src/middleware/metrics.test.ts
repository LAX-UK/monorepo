import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/identity-contracts", () => ({
  sharedJwksCounters: () => ({
    "https://auth.one.test/.well-known/jwks.json": { fetchFailures: 2, staleServes: 5 },
    "https://auth.two.test/.well-known/jwks.json": { fetchFailures: 1, staleServes: 0 },
  }),
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
});
