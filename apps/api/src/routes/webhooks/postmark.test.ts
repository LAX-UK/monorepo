import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Container } from "../../container.js";
import { createPostmarkWebhookRoutes } from "./postmark.js";

const originalNodeEnv = process.env.NODE_ENV;

function appWithEnv(nodeEnv: "development" | "production", basicAuth?: string) {
  process.env.NODE_ENV = nodeEnv;
  const app = new Hono();
  const insert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
  const container = {
    env: { NODE_ENV: nodeEnv, POSTMARK_WEBHOOK_BASIC_AUTH: basicAuth },
    db: { insert },
  } as unknown as Container;
  app.route("/webhooks/postmark", createPostmarkWebhookRoutes(container));
  return { app, insert };
}

describe("Postmark webhook auth", () => {
  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it("fails closed when basic auth is unset in production", async () => {
    const { app, insert } = appWithEnv("production");

    const res = await app.request("/webhooks/postmark", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ RecordType: "Delivery" }),
    });

    expect(res.status).toBe(503);
    expect(insert).not.toHaveBeenCalled();
  });

  it("allows missing basic auth in non-production and logs a warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { app, insert } = appWithEnv("development");

    const res = await app.request("/webhooks/postmark", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ RecordType: "Delivery" }),
    });

    expect(res.status).toBe(200);
    expect(insert).toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });
});
