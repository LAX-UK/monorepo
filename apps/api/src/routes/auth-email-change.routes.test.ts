import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createEmailChangeToken } from "../lib/email-change-token.js";
import { createAuthRoutes } from "./auth.js";

/** Deterministic HMAC input for tests only (not a production credential). */
const fixtureHmacKey = ["vitest", "email-change", "routes", "fixture"].join(":");

type UserRow = {
  id: string;
  email: string;
  pendingNewEmail: string | null;
  emailChangeOldOk: boolean;
  emailChangeNewOk: boolean;
  emailChangeExpiresAt: Date | null;
};

function createTxMock(initial: UserRow, opts?: { otherUserOnThirdLimit?: boolean }) {
  const state: UserRow = { ...initial };
  let limitCalls = 0;
  const tx = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            limitCalls += 1;
            if (limitCalls >= 3) {
              return opts?.otherUserOnThirdLimit ? [{ id: "other-user" }] : [];
            }
            return [{ ...state }];
          },
        }),
      }),
    }),
    update: () => ({
      set: (patch: Partial<UserRow>) => ({
        where: async () => {
          Object.assign(state, patch);
        },
      }),
    }),
  };
  const db = {
    transaction: vi.fn(async (fn: (t: typeof tx) => Promise<boolean>) => fn(tx)),
  };
  return { db, getState: () => state, getLimitCalls: () => limitCalls };
}

function mountAuthDb(db: object) {
  const container = {
    env: { BETTER_AUTH_SECRET: fixtureHmacKey, WEB_ORIGIN: "http://localhost:3000" },
    db,
    auth: {
      api: {
        getSession: vi.fn(async () => ({ user: { id: "u1" } })),
      },
    },
    userService: {},
    emailService: { enqueue: vi.fn() },
  };
  const app = new Hono().route("/auth", createAuthRoutes(container as never));
  return { app, auth: container.auth };
}

describe("POST /auth/confirm-email-change", () => {
  it("returns 400 when token is missing", async () => {
    const { db } = createTxMock({
      id: "u1",
      email: "old@example.com",
      pendingNewEmail: "new@example.com",
      emailChangeOldOk: false,
      emailChangeNewOk: false,
      emailChangeExpiresAt: new Date(Date.now() + 86_400_000),
    });
    const { app } = mountAuthDb(db);
    const res = await app.request("/auth/confirm-email-change", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("returns 409 for stale_flow when pending email no longer matches", async () => {
    const token = createEmailChangeToken(
      {
        userId: "u1",
        oldEmail: "old@example.com",
        newEmail: "new@example.com",
        confirmFor: "old",
      },
      fixtureHmacKey,
      3600,
    );
    const { db } = createTxMock({
      id: "u1",
      email: "old@example.com",
      pendingNewEmail: null,
      emailChangeOldOk: false,
      emailChangeNewOk: false,
      emailChangeExpiresAt: new Date(Date.now() + 86_400_000),
    });
    const { app } = mountAuthDb(db);
    const res = await app.request("/auth/confirm-email-change", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain("no longer matches");
  });

  it("returns 410 when the change window has expired", async () => {
    const token = createEmailChangeToken(
      {
        userId: "u1",
        oldEmail: "old@example.com",
        newEmail: "new@example.com",
        confirmFor: "old",
      },
      fixtureHmacKey,
      3600,
    );
    const { db } = createTxMock({
      id: "u1",
      email: "old@example.com",
      pendingNewEmail: "new@example.com",
      emailChangeOldOk: false,
      emailChangeNewOk: false,
      emailChangeExpiresAt: new Date(Date.now() - 86_400_000),
    });
    const { app } = mountAuthDb(db);
    const res = await app.request("/auth/confirm-email-change", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(res.status).toBe(410);
  });

  it("returns 409 when the new address is taken by another user", async () => {
    const token = createEmailChangeToken(
      {
        userId: "u1",
        oldEmail: "old@example.com",
        newEmail: "new@example.com",
        confirmFor: "new",
      },
      fixtureHmacKey,
      3600,
    );
    const { db } = createTxMock(
      {
        id: "u1",
        email: "old@example.com",
        pendingNewEmail: "new@example.com",
        emailChangeOldOk: true,
        emailChangeNewOk: false,
        emailChangeExpiresAt: new Date(Date.now() + 86_400_000),
      },
      { otherUserOnThirdLimit: true },
    );
    const { app } = mountAuthDb(db);
    const res = await app.request("/auth/confirm-email-change", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain("already in use");
  });

  it("returns completed false with a guidance message after the first confirmation", async () => {
    const token = createEmailChangeToken(
      {
        userId: "u1",
        oldEmail: "old@example.com",
        newEmail: "new@example.com",
        confirmFor: "old",
      },
      fixtureHmacKey,
      3600,
    );
    const { db, getState } = createTxMock({
      id: "u1",
      email: "old@example.com",
      pendingNewEmail: "new@example.com",
      emailChangeOldOk: false,
      emailChangeNewOk: false,
      emailChangeExpiresAt: new Date(Date.now() + 86_400_000),
    });
    const { app } = mountAuthDb(db);
    const res = await app.request("/auth/confirm-email-change", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { completed?: boolean; message?: string };
    expect(body.completed).toBe(false);
    expect(body.message).toContain("new address");
    expect(getState().emailChangeOldOk).toBe(true);
    expect(getState().emailChangeNewOk).toBe(false);
  });

  it("returns completed true when both sides have confirmed", async () => {
    const token = createEmailChangeToken(
      {
        userId: "u1",
        oldEmail: "old@example.com",
        newEmail: "new@example.com",
        confirmFor: "new",
      },
      fixtureHmacKey,
      3600,
    );
    const { db, getState } = createTxMock({
      id: "u1",
      email: "old@example.com",
      pendingNewEmail: "new@example.com",
      emailChangeOldOk: true,
      emailChangeNewOk: false,
      emailChangeExpiresAt: new Date(Date.now() + 86_400_000),
    });
    const { app } = mountAuthDb(db);
    const res = await app.request("/auth/confirm-email-change", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { completed?: boolean };
    expect(body.completed).toBe(true);
    expect(getState().email).toBe("new@example.com");
    expect(getState().pendingNewEmail).toBeNull();
  });
});

describe("DELETE /auth/change-email", () => {
  it("returns 401 without a session", async () => {
    const db = { transaction: vi.fn() };
    const container = {
      env: { BETTER_AUTH_SECRET: fixtureHmacKey, WEB_ORIGIN: "http://localhost:3000" },
      db,
      auth: { api: { getSession: vi.fn(async () => null) } },
      userService: {},
      emailService: { enqueue: vi.fn() },
    };
    const app = new Hono().route("/auth", createAuthRoutes(container as never));
    const res = await app.request("/auth/change-email", { method: "DELETE" });
    expect(res.status).toBe(401);
  });

  it("returns 400 when no change is in progress", async () => {
    const selectLimit = vi.fn().mockResolvedValue([{ pendingNewEmail: null }]);
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: selectLimit,
          })),
        })),
      })),
      update: vi.fn(),
    };
    const { app } = mountAuthDb(db);
    const res = await app.request("/auth/change-email", { method: "DELETE" });
    expect(res.status).toBe(400);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("clears pending fields when a change is active", async () => {
    const selectLimit = vi.fn().mockResolvedValue([{ pendingNewEmail: "next@example.com" }]);
    const setSpy = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: selectLimit,
          })),
        })),
      })),
      update: vi.fn(() => ({ set: setSpy })),
    };
    const { app } = mountAuthDb(db);
    const res = await app.request("/auth/change-email", { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(db.update).toHaveBeenCalled();
    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        pendingNewEmail: null,
        emailChangeOldOk: false,
        emailChangeNewOk: false,
        emailChangeExpiresAt: null,
      }),
    );
  });
});
