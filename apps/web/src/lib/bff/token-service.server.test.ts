import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedBidSession } from "./session-store.server";

const oidc = vi.hoisted(() => ({
  exchangeResourceToken: vi.fn(),
  refreshIdentityTokens: vi.fn(),
}));

vi.mock("./oidc.server", () => oidc);

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
    const service = new BidBffTokenService(sessions as never);

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
    const service = new BidBffTokenService(sessions as never);

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
});
