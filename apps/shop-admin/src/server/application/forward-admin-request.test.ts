import { describe, expect, it } from "vitest";
import { createMemorySessionStore } from "../infrastructure/memory-session-store";
import { forwardAdminRequest } from "./forward-admin-request";

describe("forwardAdminRequest", () => {
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
