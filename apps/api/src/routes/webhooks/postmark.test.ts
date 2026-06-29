import type { Database } from "@auction/db";
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
    const inserted: unknown[] = [];
    const selectLimit = vi.fn().mockResolvedValue([]);
    const db = {
      insert: vi.fn(() => ({
        values: vi.fn((v: unknown) => {
          inserted.push(v);
          const row = v as Record<string, unknown>;
          if ("provider" in row && row.provider === "postmark") {
            return Promise.resolve(undefined);
          }
          return {
            onConflictDoUpdate: vi.fn(() => Promise.resolve(undefined)),
          };
        }),
      })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: selectLimit,
          })),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve(undefined)),
        })),
      })),
    } as unknown as Database;
    const postmarkWebhookService = new PostmarkWebhookService(db, vi.fn());
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
    const suppression = inserted.find(
      (v) => typeof v === "object" && v !== null && "emailHash" in v && !("provider" in v),
    ) as { emailHash: string; reason: string } | undefined;
    expect(suppression?.reason).toBe("hard_bounce");
    expect(suppression?.emailHash).toBe(emailHash("seller@example.com"));
    expect(selectLimit).toHaveBeenCalled();
    expect(db.update).toHaveBeenCalled();
  });
});
