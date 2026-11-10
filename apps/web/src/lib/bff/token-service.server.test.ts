import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedBidSession } from "./session-store.server";

const oidc = vi.hoisted(() => ({
  exchangeResourceToken: vi.fn(),
  refreshIdentityTokens: vi.fn(),
}));

vi.mock("./oidc.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./oidc.server")>();
  return {
    ...actual,
    exchangeResourceToken: oidc.exchangeResourceToken,
    refreshIdentityTokens: oidc.refreshIdentityTokens,
  };
});

import { BidBffTokenService } from "./token-service.server";

class DeterministicSessionStore {
  private lockTail: Promise<void> = Promise.resolve();

  constructor(private session: AuthenticatedBidSession) {}

  async read() {
    return this.session;
  }

  async updateAuthenticated(_id: string, session: AuthenticatedBidSession) {
    this.session = session;
    return true;
  }

  async withRefreshLock<T>(
    _id: string,
    operation: (lock: {
      assertOwned(): Promise<void>;
      updateAuthenticated(session: AuthenticatedBidSession): Promise<boolean>;
    }) => Promise<T>,
  ): Promise<T> {
    const previous = this.lockTail;
    let release = () => {};
    this.lockTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation({
        assertOwned: async () => {},
        updateAuthenticated: async (session) => this.updateAuthenticated(_id, session),
      });
    } finally {
      release();
    }
  }
}

describe("BidBffTokenService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reuses a broader cached resource token for narrower scope requests", async () => {
    const sessions = new DeterministicSessionStore({
      kind: "authenticated",
      subject: "user-1",
      sid: "sid-1",
      idToken: "id-token",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      accessTokenExpiresAt: Date.now() + 120_000,
      resourceTokens: {
        "lax-bid-api": {
          token: "resource-token",
          expiresAt: Date.now() + 120_000,
          scopes: "bid.read bid.write",
        },
      },
    });
    const service = new BidBffTokenService(sessions as never, async () => true);

    const result = await service.resourceToken("session-id", "lax-bid-api", "bid.read");

    expect(oidc.exchangeResourceToken).not.toHaveBeenCalled();
    expect(result.token).toBe("resource-token");
  });

  it("single-flights parallel resource token requests and returns the persisted result", async () => {
    const sessions = new DeterministicSessionStore({
      kind: "authenticated",
      subject: "user-1",
      sid: "sid-1",
      idToken: "id-token",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      accessTokenExpiresAt: Date.now() - 1,
      resourceTokens: {},
    });
    oidc.refreshIdentityTokens.mockImplementation(async (session) => {
      await Promise.resolve();
      return {
        ...session,
        accessToken: "refreshed-access-token",
        accessTokenExpiresAt: Date.now() + 120_000,
      };
    });
    oidc.exchangeResourceToken.mockImplementation(async () => {
      await Promise.resolve();
      return {
        token: "resource-token",
        expiresAt: Date.now() + 120_000,
        scopes: "bid.read",
      };
    });
    const service = new BidBffTokenService(sessions as never, async () => true);

    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        service.resourceToken("session-id", "lax-bid-api", "bid.read"),
      ),
    );

    expect(oidc.refreshIdentityTokens).toHaveBeenCalledTimes(1);
    expect(oidc.exchangeResourceToken).toHaveBeenCalledTimes(1);
    expect(oidc.exchangeResourceToken).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: "refreshed-access-token" }),
      "lax-bid-api",
      "bid.read",
    );
    expect(results.map(({ token }) => token)).toEqual(Array(8).fill("resource-token"));
    expect(
      results.every(
        ({ session }) => session.resourceTokens["lax-bid-api"]?.token === "resource-token",
      ),
    ).toBe(true);
  });

  it("invalidates the session when refresh receives a 4xx from the issuer", async () => {
    const { IdentityRejectedError } = await import("@auction/identity-rp");
    const sessions = new DeterministicSessionStore({
      kind: "authenticated",
      subject: "user-1",
      sid: "sid-1",
      idToken: "id-token",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      accessTokenExpiresAt: Date.now() - 1,
      resourceTokens: {},
    });
    oidc.refreshIdentityTokens.mockRejectedValue(new IdentityRejectedError(401, "invalid_grant"));
    const service = new BidBffTokenService(sessions as never, async () => true);

    await expect(
      service.resourceToken("session-id", "lax-bid-api", "bid.read"),
    ).rejects.toMatchObject({
      name: "BidBffSessionRequiredError",
    });
  });

  it("preserves the session and surfaces unavailable when refresh cannot reach the issuer", async () => {
    const { IdentityUnavailableError } = await import("@auction/identity-rp");
    const sessions = new DeterministicSessionStore({
      kind: "authenticated",
      subject: "user-1",
      sid: "sid-1",
      idToken: "id-token",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      accessTokenExpiresAt: Date.now() - 1,
      resourceTokens: {},
    });
    oidc.refreshIdentityTokens.mockRejectedValue(
      new IdentityUnavailableError("Identity token endpoint is unavailable"),
    );
    const service = new BidBffTokenService(sessions as never, async () => true);

    await expect(
      service.resourceToken("session-id", "lax-bid-api", "bid.read"),
    ).rejects.toMatchObject({
      name: "BidBffIdentityUnavailableError",
    });
  });

  it("exchanges again when the cached token's signing key was retired", async () => {
    const sessions = new DeterministicSessionStore({
      kind: "authenticated",
      subject: "user-1",
      sid: "sid-1",
      idToken: "id-token",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      accessTokenExpiresAt: Date.now() + 120_000,
      resourceTokens: {
        "lax-bid-api": {
          token: "token-from-retired-key",
          expiresAt: Date.now() + 120_000,
          scopes: "bid.read",
        },
      },
    });
    oidc.exchangeResourceToken.mockResolvedValue({
      token: "token-from-new-key",
      expiresAt: Date.now() + 120_000,
      scopes: "bid.read",
    });
    const isKeyCurrent = vi.fn(async (token: string) => token !== "token-from-retired-key");
    const service = new BidBffTokenService(sessions as never, isKeyCurrent);

    const result = await service.resourceToken("session-id", "lax-bid-api", "bid.read");

    expect(isKeyCurrent).toHaveBeenCalledWith("token-from-retired-key");
    expect(oidc.exchangeResourceToken).toHaveBeenCalledTimes(1);
    expect(result.token).toBe("token-from-new-key");
    expect(result.session.resourceTokens["lax-bid-api"]?.token).toBe("token-from-new-key");
  });

  it("does not exchange again for a token signed by a key newer than the last key set fetch", async () => {
    const sessions = new DeterministicSessionStore({
      kind: "authenticated",
      subject: "user-1",
      sid: "sid-1",
      idToken: "id-token",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      accessTokenExpiresAt: Date.now() + 120_000,
      resourceTokens: {},
    });
    oidc.exchangeResourceToken.mockResolvedValue({
      token: "token-from-newer-key",
      expiresAt: Date.now() + 120_000,
      scopes: "bid.read",
    });
    // The key check keeps a token whose key it cannot yet judge retired.
    const isKeyCurrent = vi.fn(async () => true);
    const service = new BidBffTokenService(sessions as never, isKeyCurrent);

    await service.resourceToken("session-id", "lax-bid-api", "bid.read");
    await service.resourceToken("session-id", "lax-bid-api", "bid.read");
    await service.resourceToken("session-id", "lax-bid-api", "bid.read");

    expect(oidc.exchangeResourceToken).toHaveBeenCalledTimes(1);
  });

  describe("replacing a rejected token", () => {
    function sessionHolding(token: string) {
      return new DeterministicSessionStore({
        kind: "authenticated",
        subject: "user-1",
        sid: "sid-1",
        idToken: "id-token",
        accessToken: "access-token",
        refreshToken: "refresh-token",
        accessTokenExpiresAt: Date.now() + 120_000,
        resourceTokens: {
          "lax-bid-api": { token, expiresAt: Date.now() + 120_000, scopes: "bid.read" },
        },
      });
    }

    it("exchanges once when concurrent requests are rejected for the same token", async () => {
      const sessions = sessionHolding("stale");
      oidc.exchangeResourceToken.mockImplementation(async () => {
        await Promise.resolve();
        return { token: "fresh", expiresAt: Date.now() + 120_000, scopes: "bid.read" };
      });
      const service = new BidBffTokenService(sessions as never, async () => true);

      const results = await Promise.all([
        service.resourceToken("session-id", "lax-bid-api", "bid.read", { replacing: "stale" }),
        service.resourceToken("session-id", "lax-bid-api", "bid.read", { replacing: "stale" }),
        service.resourceToken("session-id", "lax-bid-api", "bid.read", { replacing: "stale" }),
      ]);

      expect(oidc.exchangeResourceToken).toHaveBeenCalledTimes(1);
      expect(results.map(({ token }) => token)).toEqual(["fresh", "fresh", "fresh"]);
    });

    it("reuses a different cached token that a concurrent request already stored", async () => {
      const sessions = sessionHolding("already-replaced");
      const service = new BidBffTokenService(sessions as never, async () => true);

      const result = await service.resourceToken("session-id", "lax-bid-api", "bid.read", {
        replacing: "stale",
      });

      expect(oidc.exchangeResourceToken).not.toHaveBeenCalled();
      expect(result.token).toBe("already-replaced");
    });

    it("exchanges when the cache still holds the rejected token", async () => {
      const sessions = sessionHolding("stale");
      oidc.exchangeResourceToken.mockResolvedValue({
        token: "fresh",
        expiresAt: Date.now() + 120_000,
        scopes: "bid.read",
      });
      const service = new BidBffTokenService(sessions as never, async () => true);

      const result = await service.resourceToken("session-id", "lax-bid-api", "bid.read", {
        replacing: "stale",
      });

      expect(oidc.exchangeResourceToken).toHaveBeenCalledTimes(1);
      expect(result.token).toBe("fresh");
    });

    it("does not reuse a different cached token that is itself unusable", async () => {
      const sessions = sessionHolding("also-retired");
      oidc.exchangeResourceToken.mockResolvedValue({
        token: "fresh",
        expiresAt: Date.now() + 120_000,
        scopes: "bid.read",
      });
      const service = new BidBffTokenService(
        sessions as never,
        async (token) => token !== "also-retired",
      );

      const result = await service.resourceToken("session-id", "lax-bid-api", "bid.read", {
        replacing: "stale",
      });

      expect(result.token).toBe("fresh");
    });
  });
});
