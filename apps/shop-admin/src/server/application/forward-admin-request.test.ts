import { describe, expect, it, vi } from "vitest";
import { createMemorySessionStore } from "../infrastructure/memory-session-store";
import { forwardAdminRequest } from "./forward-admin-request";

const config = {
  NODE_ENV: "test",
  publicOrigin: "http://localhost:3030",
  bffInternalOrigin: "http://localhost:3030",
  oidcIssuer: "http://localhost:3001",
  oidcInternalIssuer: "http://localhost:3001",
  oidcClientId: "lax-shop-admin",
  oidcClientSecret: "secret-minimum-length-for-tests",
  shopApiBaseUrl: "http://127.0.0.1:3011",
  redisUrl: "redis://127.0.0.1:6379",
  sessionEncryptionKey: "01234567890123456789012345678901",
  sessionTtlSeconds: 3600,
} as const;

const NOW_MS = 1_800_000_000_000;

async function forwardStaffGrantFromServerAction(authAgeSeconds: number) {
  const sessions = createMemorySessionStore();
  await sessions.save(
    "session-1",
    {
      subject: "staff-1",
      sid: "sid-1",
      idToken: "id",
      accessToken: "access",
      refreshToken: "refresh",
      accessTokenExpiresAtMs: NOW_MS + 3_600_000,
      authTime: Math.floor(NOW_MS / 1000) - authAgeSeconds,
      acr: "silver",
    },
    3600,
  );
  const forward = vi.fn(async () => ({ status: 204, headers: {}, body: new ArrayBuffer(0) }));
  const result = forwardAdminRequest({
    config,
    sessions,
    renewal: {
      refresh: vi.fn(),
      verifyIdToken: vi.fn(),
      exchangeForShopApi: vi.fn(),
    },
    adminApi: { forward },
    clock: { nowMs: () => NOW_MS },
    sessionId: "session-1",
    bffPath: "/api/admin/staff/grants",
    method: "POST",
    origin: config.publicOrigin,
    csrfHeader: null,
    csrfCookie: null,
    fromServerAction: true,
    body: undefined,
    forwardHeaders: {},
  });
  return { result, forward };
}

describe("forwardAdminRequest", () => {
  it("rejects a staff role grant from a server action when the sign-in is stale", async () => {
    const { result, forward } = await forwardStaffGrantFromServerAction(3600);
    await expect(result).rejects.toThrow();
    expect(forward).not.toHaveBeenCalled();
  });

  it("forwards a staff role grant from a server action after a recent sign-in", async () => {
    const { result, forward } = await forwardStaffGrantFromServerAction(60);
    await expect(result).resolves.toMatchObject({ status: 204 });
    expect(forward).toHaveBeenCalledOnce();
  });

  it("rejects unauthenticated proxy calls", async () => {
    await expect(
      forwardAdminRequest({
        config: {
          NODE_ENV: "test",
          publicOrigin: "http://localhost:3030",
          bffInternalOrigin: "http://localhost:3030",
          oidcIssuer: "http://localhost:3001",
          oidcInternalIssuer: "http://localhost:3001",
          oidcClientId: "lax-shop-admin",
          oidcClientSecret: "secret-minimum-length-for-tests",
          shopApiBaseUrl: "http://127.0.0.1:3011",
          redisUrl: "redis://127.0.0.1:6379",
          sessionEncryptionKey: "01234567890123456789012345678901",
          sessionTtlSeconds: 3600,
        },
        sessions: createMemorySessionStore(),
        renewal: { refresh: vi.fn(), verifyIdToken: vi.fn(), exchangeForShopApi: vi.fn() },
        adminApi: {
          forward: async () => ({
            status: 200,
            headers: {},
            body: new ArrayBuffer(0),
          }),
        },
        clock: { nowMs: () => Date.now() },
        sessionId: null,
        bffPath: "/api/admin/session",
        method: "GET",
        origin: null,
        csrfHeader: null,
        csrfCookie: null,
        body: undefined,
        forwardHeaders: {},
      }),
    ).rejects.toThrow(/Unauthorized/);
  });
});
