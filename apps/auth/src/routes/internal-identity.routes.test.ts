import { describe, expect, it, vi } from "vitest";
import type { IIdentityLifecycleService } from "../services/identity-lifecycle.service.js";
import { IdentityOperationError } from "../services/identity-operations.service.js";
import { createInternalIdentityRoutes } from "./internal-identity.routes.js";

function setup() {
  const tokens = new Map<string, string>();
  const lifecycle = {
    disable: vi.fn(async () => undefined),
    enable: vi.fn(async () => undefined),
    merge: vi.fn(async () => undefined),
  } satisfies IIdentityLifecycleService;
  const operations = {
    listSessions: vi.fn(async () => []),
    setupPassword: vi.fn(async () => undefined),
    verifyPasswordAndStamp: vi.fn(async () => undefined),
    revokeSession: vi.fn(async () => true),
    startEmailChange: vi.fn(async () => undefined),
    markDeletionRequested: vi.fn(async () => undefined),
    cancelDeletionRequested: vi.fn(async () => undefined),
  };
  const app = createInternalIdentityRoutes({
    lifecycle,
    operations: operations as never,
    redis: {
      get: async (key) => tokens.get(key) ?? null,
      set: async (key, value) => {
        tokens.set(key, value);
      },
    },
    machineClientId: "api-service",
    machineClientSecret: "machine-secret-at-least-32-characters",
    allowMerge: true,
  });
  return { app, lifecycle, operations };
}

async function issueToken(app: ReturnType<typeof createInternalIdentityRoutes>): Promise<string> {
  const basic = Buffer.from("api-service:machine-secret-at-least-32-characters", "utf8").toString(
    "base64",
  );
  const response = await app.request("/oauth/token", {
    method: "POST",
    headers: {
      authorization: `Basic ${basic}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=identity.lifecycle",
  });
  expect(response.status).toBe(200);
  const body = (await response.json()) as { access_token: string };
  return body.access_token;
}

describe("internal Identity machine routes", () => {
  it("rejects lifecycle operations without a machine token", async () => {
    const { app } = setup();
    const response = await app.request("/identity/subjects/u1/disable", { method: "POST" });
    expect(response.status).toBe(401);
  });

  it("issues a short-lived client-credentials token and disables a subject", async () => {
    const { app, lifecycle } = setup();
    const token = await issueToken(app);
    const response = await app.request("/identity/subjects/u1/disable", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ reason: "security_review" }),
    });
    expect(response.status).toBe(200);
    expect(lifecycle.disable).toHaveBeenCalledWith("u1", "security_review");
  });

  it("requires the canonical subject for merges", async () => {
    const { app, lifecycle } = setup();
    const token = await issueToken(app);
    const response = await app.request("/identity/subjects/u1/merge", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: "{}",
    });
    expect(response.status).toBe(400);
    expect(lifecycle.merge).not.toHaveBeenCalled();
  });

  it("passes the cookie token only in the authenticated request body", async () => {
    const { app, operations } = setup();
    const token = await issueToken(app);
    const response = await app.request("/identity/subjects/u1/sessions/list", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ currentSessionToken: "cookie-session-token" }),
    });
    expect(response.status).toBe(200);
    expect(operations.listSessions).toHaveBeenCalledWith("u1", "cookie-session-token");
  });

  it("routes deletion requests and cancellations through auth operations", async () => {
    const { app, operations } = setup();
    const token = await issueToken(app);
    const headers = { authorization: `Bearer ${token}` };

    const requested = await app.request("/identity/subjects/u1/deletion-request", {
      method: "POST",
      headers,
    });
    const cancelled = await app.request("/identity/subjects/u1/deletion-request", {
      method: "DELETE",
      headers,
    });

    expect(requested.status).toBe(200);
    expect(cancelled.status).toBe(200);
    expect(operations.markDeletionRequested).toHaveBeenCalledWith("u1");
    expect(operations.cancelDeletionRequested).toHaveBeenCalledWith("u1");
  });

  it("validates password and session operation bodies", async () => {
    const { app, operations } = setup();
    const token = await issueToken(app);
    const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };

    const password = await app.request("/identity/subjects/u1/credentials/password", {
      method: "POST",
      headers,
      body: "{}",
    });
    const session = await app.request("/identity/subjects/u1/sessions/revoke", {
      method: "POST",
      headers,
      body: "{}",
    });

    expect(password.status).toBe(400);
    expect(session.status).toBe(400);
    expect(operations.setupPassword).not.toHaveBeenCalled();
    expect(operations.revokeSession).not.toHaveBeenCalled();
  });

  it("maps password operation errors without leaking credentials", async () => {
    const { app, operations } = setup();
    operations.verifyPasswordAndStamp.mockRejectedValueOnce(
      new IdentityOperationError("invalid_password"),
    );
    const token = await issueToken(app);
    const response = await app.request("/identity/subjects/u1/step-up/verify-password", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ password: "wrong", sessionToken: "opaque-cookie-token" }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "invalid_password" });
  });

  it.each(["not-a-date", "2020-01-01T00:00:00.000Z"])(
    "rejects invalid email-change expiry %s before storage",
    async (expiresAt) => {
      const { app, operations } = setup();
      const token = await issueToken(app);
      const response = await app.request("/identity/subjects/u1/email-change/start", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ newEmail: "next@example.com", expiresAt }),
      });

      expect(response.status).toBe(400);
      expect(operations.startEmailChange).not.toHaveBeenCalled();
    },
  );

  it("maps email conflicts to conflict responses", async () => {
    const { app, operations } = setup();
    operations.startEmailChange.mockRejectedValueOnce(new IdentityOperationError("email_taken"));
    const token = await issueToken(app);
    const response = await app.request("/identity/subjects/u1/email-change/start", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        newEmail: "taken@example.com",
        expiresAt: "2099-01-01T00:00:00.000Z",
      }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "email_taken" });
  });
});
