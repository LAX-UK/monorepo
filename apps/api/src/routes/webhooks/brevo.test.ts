import { emailHash } from "@auction/email";
import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Container } from "../../container.js";
import { BrevoWebhookIngestService } from "../../services/brevo-webhook-ingest.service.js";
import { createBrevoWebhookRoutes } from "./brevo.js";

const originalNodeEnv = process.env.NODE_ENV;

function makeApp(nodeEnv: "development" | "production", secret?: string) {
  process.env.NODE_ENV = nodeEnv;
  const upserted: Array<{ emailHash: string; reason: string }> = [];
  const emailSuppressions = {
    upsert: vi.fn(async (hash: string, reason: string) => {
      upserted.push({ emailHash: hash, reason });
    }),
  };
  const updateUserEmailStatusByEmail = vi.fn(async () => undefined);
  const emailWebhookIngest = {
    insertEmailEvent: vi.fn(),
    findOutboxByMessageId: vi.fn(),
    countSoftBouncesForEmailSince: vi.fn(),
    updateUserEmailStatusByEmail,
    updateUserEmailStatusByUserId: vi.fn(),
  };
  const container = {
    env: { NODE_ENV: nodeEnv, BREVO_WEBHOOK_SECRET: secret },
    brevoWebhookIngestService: new BrevoWebhookIngestService(emailSuppressions, emailWebhookIngest),
  } as unknown as Container;
  const app = new Hono();
  app.route("/webhooks/brevo", createBrevoWebhookRoutes(container));
  return { app, upserted, updateUserEmailStatusByEmail };
}

function post(app: Hono, body: unknown, query = "") {
  return app.request(`/webhooks/brevo${query}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Brevo webhook auth", () => {
  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it("fails closed when the secret is unset in production", async () => {
    const { app, upserted } = makeApp("production");
    const res = await post(app, { event: "unsubscribe", email: "a@b.com" });
    expect(res.status).toBe(503);
    expect(upserted).toHaveLength(0);
  });

  it("rejects a wrong secret", async () => {
    const { app } = makeApp("production", "right");
    const res = await post(app, { event: "unsubscribe", email: "a@b.com" }, "?secret=wrong");
    expect(res.status).toBe(401);
  });

  it("accepts a matching secret via query param", async () => {
    const { app, upserted } = makeApp("production", "right");
    const res = await post(app, { event: "unsubscribe", email: "a@b.com" }, "?secret=right");
    expect(res.status).toBe(200);
    expect(upserted).toHaveLength(1);
  });
});

describe("Brevo webhook event mapping", () => {
  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it("suppresses an unsubscribe without touching user.email_status", async () => {
    const { app, upserted, updateUserEmailStatusByEmail } = makeApp("development");
    const res = await post(app, { event: "unsubscribe", email: "Buyer@Example.com" });
    expect(res.status).toBe(200);
    expect(upserted[0]).toMatchObject({
      reason: "unsubscribe",
      emailHash: emailHash("buyer@example.com"),
    });
    expect(updateUserEmailStatusByEmail).not.toHaveBeenCalled();
  });

  it("maps hardbounce alias to suppression + user.email_status=bounced", async () => {
    const { app, upserted, updateUserEmailStatusByEmail } = makeApp("development");
    const res = await post(app, { event: "hardbounce", email: "x@y.com" });
    expect(res.status).toBe(200);
    expect(upserted[0]).toMatchObject({ reason: "hard_bounce" });
    expect(updateUserEmailStatusByEmail).toHaveBeenCalledWith("x@y.com", "bounced");
  });

  it("maps a hard bounce to suppression + user.email_status=bounced", async () => {
    const { app, upserted, updateUserEmailStatusByEmail } = makeApp("development");
    const res = await post(app, { event: "hard_bounce", email: "x@y.com" });
    expect(res.status).toBe(200);
    expect(upserted[0]).toMatchObject({ reason: "hard_bounce" });
    expect(updateUserEmailStatusByEmail).toHaveBeenCalledWith("x@y.com", "bounced");
  });

  it("ignores delivery/open events", async () => {
    const { app, upserted } = makeApp("development");
    const res = await post(app, { event: "delivered", email: "x@y.com" });
    expect(res.status).toBe(200);
    expect(upserted).toHaveLength(0);
  });

  it("ignores events with no email", async () => {
    const { app, upserted } = makeApp("development");
    const res = await post(app, { event: "unsubscribe" });
    expect(res.status).toBe(200);
    expect(upserted).toHaveLength(0);
  });
});
