import { IDENTITY_EMAIL_TEMPLATE_NAMES } from "@auction/auth";
import { templateNames } from "@auction/email";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createInternalIdentityEmailRoutes } from "./internal-identity-email.routes.js";

const credentials = {
  IDENTITY_MACHINE_CLIENT_ID: "auth-service",
  IDENTITY_MACHINE_CLIENT_SECRET: "identity-machine-secret-at-least-32-characters",
};
const validBody = {
  template: "verify-email",
  to: "subject@example.com",
  userId: "subject-1",
  vars: { verificationUrl: "https://auth.example.com/verify" },
  category: "auth",
} as const;

function createApp(enqueue = vi.fn().mockResolvedValue({ outboxId: "outbox-1" })) {
  const app = new Hono().route(
    "/internal/identity",
    createInternalIdentityEmailRoutes({ emailService: { enqueue } } as never, credentials),
  );
  return { app, enqueue };
}

function authHeaders() {
  return {
    "content-type": "application/json",
    "x-identity-client-id": credentials.IDENTITY_MACHINE_CLIENT_ID,
    "x-identity-client-secret": credentials.IDENTITY_MACHINE_CLIENT_SECRET,
  };
}

describe("internal Identity email routes", () => {
  it("keeps the Identity template contract compatible with the email renderer", () => {
    expect(IDENTITY_EMAIL_TEMPLATE_NAMES.every((name) => templateNames.includes(name))).toBe(true);
  });

  it("requires configured, matching machine credentials", async () => {
    const unconfigured = new Hono().route(
      "/internal/identity",
      createInternalIdentityEmailRoutes({ emailService: { enqueue: vi.fn() } } as never, {
        IDENTITY_MACHINE_CLIENT_ID: undefined,
        IDENTITY_MACHINE_CLIENT_SECRET: undefined,
      }),
    );
    const unavailable = await unconfigured.request("/internal/identity/emails", {
      method: "POST",
      body: JSON.stringify(validBody),
    });
    expect(unavailable.status).toBe(503);

    const { app, enqueue } = createApp();
    const unauthorized = await app.request("/internal/identity/emails", {
      method: "POST",
      headers: { ...authHeaders(), "x-identity-client-secret": "wrong" },
      body: JSON.stringify(validBody),
    });
    expect(unauthorized.status).toBe(401);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("rejects malformed and unsupported email requests", async () => {
    const { app, enqueue } = createApp();
    const response = await app.request("/internal/identity/emails", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ ...validBody, template: "admin-invite" }),
    });

    expect(response.status).toBe(400);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("enqueues through the existing outbox with a snapshot recipient", async () => {
    const { app, enqueue } = createApp();
    const response = await app.request("/internal/identity/emails", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        ...validBody,
        stream: "transactional",
        idempotencyKey: "verify-email:subject-1:request-1",
      }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ data: { outboxId: "outbox-1" } });
    expect(enqueue).toHaveBeenCalledWith({
      ...validBody,
      stream: "transactional",
      idempotencyKey: "verify-email:subject-1:request-1",
      recipientResolution: "snapshot",
    });
  });

  it("returns a stable unavailable response when enqueue fails", async () => {
    const { app } = createApp(vi.fn().mockRejectedValue(new Error("database unavailable")));
    const response = await app.request("/internal/identity/emails", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(validBody),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "identity_email_enqueue_unavailable",
    });
  });
});
