import type { OidcTokenResponse, TokenEndpoint } from "@auction/identity-rp";
import { describe, expect, it, vi } from "vitest";
import type { SessionHandle } from "../ports/portfolio-gateway";
import type { StaffSessionRecord } from "../ports/session-store";
import { createExchangeResourceTokenProvider } from "./exchange-resource-token-provider";
import { createMemorySessionStore } from "./memory-session-store";

const NOW = 1_800_000_000_000;

function record(overrides: Partial<StaffSessionRecord> = {}): StaffSessionRecord {
  return {
    subject: "user-1",
    sid: "sid-1",
    idToken: "id-token",
    accessToken: "access",
    refreshToken: "refresh",
    accessTokenExpiresAtMs: NOW + 3_600_000,
    authTime: 1,
    acr: "",
    ...overrides,
  };
}

function endpoint(
  respond: (body: URLSearchParams) => OidcTokenResponse | Error,
): TokenEndpoint & { calls: URLSearchParams[] } {
  const calls: URLSearchParams[] = [];
  return {
    calls,
    requestToken: vi.fn(async (body: URLSearchParams) => {
      calls.push(body);
      const result = respond(body);
      if (result instanceof Error) throw result;
      return result;
    }),
  };
}

const issued = (token: string, expiresIn = 300): OidcTokenResponse => ({
  access_token: token,
  token_type: "Bearer",
  expires_in: expiresIn,
});

async function setup(stored: StaffSessionRecord, tokenEndpoint: TokenEndpoint) {
  const sessions = createMemorySessionStore();
  await sessions.save("sess", stored, 3600);
  const provider = createExchangeResourceTokenProvider({
    tokenEndpoint,
    sessions,
    sessionTtlSeconds: 3600,
    nowMs: () => NOW,
  });
  const handle: SessionHandle = { sessionId: "sess", record: stored };
  return { sessions, provider, handle };
}

describe("createExchangeResourceTokenProvider", () => {
  it("exchanges the ID token for one resource and only the portfolio scope", async () => {
    const tokenEndpoint = endpoint(() => issued("bid-token"));
    const { provider, handle } = await setup(record(), tokenEndpoint);

    expect(await provider.tokenFor(handle, "lax-bid-api")).toBe("bid-token");

    const body = tokenEndpoint.calls[0];
    expect(body?.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:token-exchange");
    expect(body?.get("subject_token")).toBe("id-token");
    expect(body?.get("subject_token_type")).toBe("urn:ietf:params:oauth:token-type:id_token");
    expect(body?.getAll("resource")).toEqual(["https://api.lax.bid"]);
    expect(body?.get("scope")).toBe("lax.portfolio.read");
  });

  it("asks for each product's own audience in its own exchange", async () => {
    const tokenEndpoint = endpoint((body) =>
      issued(body.get("resource") === "https://api.lax.bid" ? "bid-token" : "shop-token"),
    );
    const { provider, handle } = await setup(record(), tokenEndpoint);

    expect(await provider.tokenFor(handle, "lax-bid-api")).toBe("bid-token");
    expect(await provider.tokenFor(handle, "lax-shop-api")).toBe("shop-token");
    expect(tokenEndpoint.calls.map((call) => call.getAll("resource"))).toEqual([
      ["https://api.lax.bid"],
      ["https://shop.lax.art/api"],
    ]);
  });

  it("caches the token in the session for its lifetime", async () => {
    const tokenEndpoint = endpoint(() => issued("bid-token", 300));
    const { provider, sessions, handle } = await setup(record(), tokenEndpoint);

    await provider.tokenFor(handle, "lax-bid-api");
    const stored = await sessions.get("sess");
    expect(stored?.resourceTokens?.["lax-bid-api"]).toEqual({
      token: "bid-token",
      expiresAtMs: NOW + 300_000,
    });

    const reused = await provider.tokenFor(
      { sessionId: "sess", record: stored as never },
      "lax-bid-api",
    );
    expect(reused).toBe("bid-token");
    expect(tokenEndpoint.calls).toHaveLength(1);
  });

  it("exchanges again once the cached token is about to expire", async () => {
    const tokenEndpoint = endpoint(() => issued("fresh-token"));
    const nearlyExpired = record({
      resourceTokens: { "lax-bid-api": { token: "old-token", expiresAtMs: NOW + 10_000 } },
    });
    const { provider, handle } = await setup(nearlyExpired, tokenEndpoint);

    expect(await provider.tokenFor(handle, "lax-bid-api")).toBe("fresh-token");
  });

  it("keeps the session's newer tokens when it caches", async () => {
    const tokenEndpoint = endpoint(() => issued("bid-token"));
    const stale = record();
    const { provider, sessions } = await setup(stale, tokenEndpoint);
    // The session was refreshed after the page loaded its copy.
    await sessions.save("sess", record({ refreshToken: "refresh-rotated" }), 3600);

    await provider.tokenFor({ sessionId: "sess", record: stale }, "lax-bid-api");

    expect((await sessions.get("sess"))?.refreshToken).toBe("refresh-rotated");
  });

  it("still returns the token when it cannot be cached", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const tokenEndpoint = endpoint(() => issued("bid-token"));
    const { provider, sessions, handle } = await setup(record(), tokenEndpoint);
    vi.spyOn(sessions, "withRefreshLock").mockRejectedValue(new Error("redis down"));

    expect(await provider.tokenFor(handle, "lax-bid-api")).toBe("bid-token");
  });

  it("lets an exchange failure reach the caller", async () => {
    const tokenEndpoint = endpoint(() => new Error("invalid_target"));
    const { provider, handle } = await setup(record(), tokenEndpoint);

    await expect(provider.tokenFor(handle, "lax-bid-api")).rejects.toThrow("invalid_target");
  });
});
