import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/bff/redis.server", () => ({
  getBffRedis: () => ({}),
}));
vi.mock("@/lib/bff/session-store.server", () => ({
  BidBffSessionStore: class {
    read = vi.fn();
    createPending = vi.fn();
  },
}));
vi.mock("@/lib/bff/session-cookie.server", () => ({
  readBidSessionId: vi.fn(),
  setBidSessionCookie: vi.fn(),
}));
vi.mock("@/lib/bff/oidc.server", () => ({
  buildAuthorizationUrl: vi.fn(() => "https://auth.example/authorize"),
  createLoginProof: vi.fn(() => ({
    state: "state",
    nonce: "nonce",
    codeVerifier: "verifier",
  })),
}));
vi.mock("@/lib/bff/auth-entry-intent.server", () => ({
  resolveHostedAuthEntry: vi.fn(() => ({ nextPath: "/dashboard" })),
  authorizeParamsForEntry: vi.fn(() => ({})),
  pendingIntentForStorage: vi.fn(() => undefined),
}));

const { startBidAuthorization } = await import("./start-bid-authorization.server");

describe("startBidAuthorization", () => {
  it("returns 204 without side effects for prefetch/RSC requests", async () => {
    const request = new NextRequest("https://lax.bid/api/auth/login", {
      headers: { "next-router-prefetch": "1", rsc: "1" },
    });
    const response = await startBidAuthorization({ request });
    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
