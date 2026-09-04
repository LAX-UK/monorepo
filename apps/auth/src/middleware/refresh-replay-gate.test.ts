import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { IRefreshTokenFamilyRepository } from "../services/refresh-token-family.ports.js";
import { createOAuthTokenRequestContextMiddleware } from "./oauth-token-request-context.js";
import {
  type RefreshReplayRedis,
  createRefreshReplayGateMiddleware,
} from "./refresh-replay-gate.js";

function setup(nowValue = 1_000) {
  let now = nowValue;
  const values = new Map<string, string>();
  const replay: RefreshReplayRedis = {
    reserve: async (key, value) => {
      if (values.has(key)) return false;
      values.set(key, value);
      return true;
    },
    get: async (key) => values.get(key) ?? null,
    put: async (key, value) => {
      values.set(key, value);
    },
    delete: async (key) => {
      values.delete(key);
    },
  };
  const families = {
    findAndPrepare: vi.fn(async () => ({
      tokenId: "token-1",
      userId: "user-1",
      familyId: "family-1",
      expiresAt: new Date(now + 60_000),
    })),
    completeRotation: vi.fn(async () => undefined),
    revokeFamily: vi.fn(async () => undefined),
  } satisfies IRefreshTokenFamilyRepository;
  const app = new Hono();
  app.use("/api/auth/oauth2/token", createOAuthTokenRequestContextMiddleware());
  app.use(
    "/api/auth/*",
    createRefreshReplayGateMiddleware({
      replay,
      families,
      graceMs: 5_000,
      now: () => now,
      retryResponseCrypto: {
        seal: (value) => value,
        open: (value) => value,
      },
    }),
  );
  app.post("/api/auth/oauth2/token", (c) =>
    c.json({ access_token: "access", refresh_token: "refresh-next" }),
  );
  return {
    app,
    families,
    advance: (milliseconds: number) => {
      now += milliseconds;
    },
  };
}

function refreshRequest(app: Hono) {
  return app.request("/api/auth/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=refresh_token&refresh_token=refresh-current",
  });
}

function jsonRefreshRequest(app: Hono) {
  return app.request("/api/auth/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ grant_type: "refresh_token", refresh_token: "refresh-current" }),
  });
}

describe("refresh replay gate", () => {
  it("commits family linkage only after successful token rotation", async () => {
    const { app, families } = setup();
    const response = await refreshRequest(app);
    expect(response.status).toBe(200);
    expect(families.completeRotation).toHaveBeenCalledWith({
      consumedTokenId: "token-1",
      newRawToken: "refresh-next",
      familyId: "family-1",
    });
  });

  it("protects JSON token requests as well as form requests", async () => {
    const { app, families } = setup();
    const response = await jsonRefreshRequest(app);
    expect(response.status).toBe(200);
    expect(families.completeRotation).toHaveBeenCalledOnce();
  });

  it("returns the same encrypted-cached result during retry grace", async () => {
    const { app, families } = setup();
    const first = await refreshRequest(app);
    const replay = await refreshRequest(app);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual(await first.json());
    expect(families.revokeFamily).not.toHaveBeenCalled();
  });

  it("allows exactly one successor under concurrent refresh requests", async () => {
    const { app, families } = setup();
    const responses = await Promise.all([refreshRequest(app), refreshRequest(app)]);
    const statuses = responses.map((response) => response.status);
    expect(statuses).toContain(200);
    expect(statuses.every((status) => status === 200 || status === 409)).toBe(true);
    expect(families.completeRotation).toHaveBeenCalledOnce();
    expect(families.revokeFamily).not.toHaveBeenCalled();
  });

  it("revokes the whole family when reuse occurs after grace", async () => {
    const { app, families, advance } = setup();
    await refreshRequest(app);
    advance(5_001);
    const replay = await refreshRequest(app);
    expect(replay.status).toBe(401);
    expect(families.revokeFamily).toHaveBeenCalledWith("family-1", "user-1");
  });
});
