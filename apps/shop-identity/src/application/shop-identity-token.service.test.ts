import { describe, expect, it, vi } from "vitest";
import { ShopIdentityReauthRequiredError } from "../errors/shop-identity-reauth.error.js";
import type { SessionTokenStore } from "./ports/session-token.ports.js";
import { createShopIdentityTokenService } from "./shop-identity-token.service.js";

function freshIdToken(): string {
  const exp = Math.floor(Date.now() / 1_000) + 3600;
  const payload = Buffer.from(JSON.stringify({ exp }), "utf8").toString("base64url");
  return `h.${payload}.s`;
}

function staleIdToken(): string {
  const exp = Math.floor(Date.now() / 1_000) - 3600;
  const payload = Buffer.from(JSON.stringify({ exp }), "utf8").toString("base64url");
  return `h.${payload}.s`;
}

describe("createShopIdentityTokenService", () => {
  it("returns a fresh id token without calling refresh", async () => {
    const refresh = vi.fn();
    const store: SessionTokenStore = {
      read: vi.fn(async () => ({
        idToken: freshIdToken(),
        refreshToken: "refresh",
        refreshExpiresAt: null,
      })),
      save: vi.fn(),
      clear: vi.fn(),
      hasStoredRefreshToken: vi.fn(async () => true),
      withLock: vi.fn(),
    };
    const service = createShopIdentityTokenService({
      store,
      refresh: { refresh },
    });
    const token = await service.resolveIdToken("session-1");
    expect(token).toContain("h.");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes stale tokens under lock", async () => {
    const onRotate = vi.fn();
    const store: SessionTokenStore = {
      read: vi.fn(async () => ({
        idToken: staleIdToken(),
        refreshToken: "old-refresh",
        refreshExpiresAt: null,
      })),
      save: vi.fn(),
      clear: vi.fn(),
      hasStoredRefreshToken: vi.fn(async () => true),
      withLock: vi.fn(async (_sessionId, run) =>
        run({
          current: {
            idToken: staleIdToken(),
            refreshToken: "old-refresh",
            refreshExpiresAt: null,
          },
          save: vi.fn(async () => undefined),
        }),
      ),
    };
    const service = createShopIdentityTokenService({
      store,
      refresh: {
        refresh: vi.fn(async () => ({
          idToken: freshIdToken(),
          refreshToken: "new-refresh",
          refreshExpiresAt: null,
        })),
      },
      onRotate,
    });
    const token = await service.resolveIdToken("session-1");
    expect(token).toContain("h.");
    expect(onRotate).toHaveBeenCalledWith("session-1");
  });

  it("raises when no refresh token is available", async () => {
    const store: SessionTokenStore = {
      read: vi.fn(async () => ({
        idToken: staleIdToken(),
        refreshToken: null,
        refreshExpiresAt: null,
      })),
      save: vi.fn(),
      clear: vi.fn(),
      hasStoredRefreshToken: vi.fn(async () => false),
      withLock: vi.fn(),
    };
    const service = createShopIdentityTokenService({
      store,
      refresh: { refresh: vi.fn() },
    });
    await expect(service.resolveIdToken("session-1")).rejects.toBeInstanceOf(
      ShopIdentityReauthRequiredError,
    );
  });
});
