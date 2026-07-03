import { emailHash } from "@auction/email";
import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Container } from "../../container.js";
import { PostmarkWebhookService } from "../../services/postmark-webhook.service.js";
import { createPostmarkWebhookRoutes } from "./postmark.js";

const originalNodeEnv = process.env.NODE_ENV;

function appWithEnv(nodeEnv: "development" | "production", basicAuth?: string) {
  process.env.NODE_ENV = nodeEnv;
  const app = new Hono();
  const handle = vi.fn().mockResolvedValue(undefined);
  const container = {
    env: { NODE_ENV: nodeEnv, POSTMARK_WEBHOOK_BASIC_AUTH: basicAuth },
    postmarkWebhookService: { handle },
  } as unknown as Container;
  app.route("/webhooks/postmark", createPostmarkWebhookRoutes(container));
  return { app, handle };
}

describe("Postmark webhook auth", () => {
  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it("fails closed when basic auth is unset in production", async () => {
    const { app, handle } = appWithEnv("production");

    const res = await app.request("/webhooks/postmark", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ RecordType: "Delivery" }),
    });

    expect(res.status).toBe(503);
    expect(handle).not.toHaveBeenCalled();
  });

  it("allows missing basic auth in non-production and logs a warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { app, handle } = appWithEnv("development");

    const res = await app.request("/webhooks/postmark", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ RecordType: "Delivery" }),
    });

    expect(res.status).toBe(200);
    expect(handle).toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });
});

describe("Postmark bounce without outbox match", () => {
  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it("falls back to recipient email suppression when MessageID is unknown", async () => {
    process.env.NODE_ENV = "development";
    const upserted: Array<{ emailHash: string; reason: string }> = [];
    const emailSuppressions = {
      upsert: vi.fn(async (hash: string, reason: string) => {
        upserted.push({ emailHash: hash, reason });
      }),
    };
    const emailWebhookIngest = {
      insertEmailEvent: vi.fn(),
      findOutboxByMessageId: vi.fn().mockResolvedValue(null),
      countSoftBouncesForEmailSince: vi.fn(),
      updateUserEmailStatusByEmail: vi.fn(),
      updateUserEmailStatusByUserId: vi.fn(),
    };
    const postmarkWebhookService = new PostmarkWebhookService(
      emailWebhookIngest,
      emailSuppressions,
      vi.fn(),
    );
    const container = {
      env: { NODE_ENV: "development", POSTMARK_WEBHOOK_BASIC_AUTH: undefined },
      postmarkWebhookService,
    } as unknown as Container;
    const app = new Hono();
    app.route("/webhooks/postmark", createPostmarkWebhookRoutes(container));

    const res = await app.request("/webhooks/postmark", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        RecordType: "Bounce",
        Type: "HardBounce",
        MessageID: "00000000-0000-0000-0000-000000000000",
        Email: "Seller@Example.com",
      }),
    });

    expect(res.status).toBe(200);
    expect(upserted[0]?.reason).toBe("hard_bounce");
    expect(upserted[0]?.emailHash).toBe(emailHash("seller@example.com"));
    expect(emailWebhookIngest.findOutboxByMessageId).toHaveBeenCalled();
    expect(emailWebhookIngest.updateUserEmailStatusByEmail).toHaveBeenCalledWith(
      "seller@example.com",
      "bounced",
    );
  });
});
