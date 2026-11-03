import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../../container.js";
import { ZohoArtworkNoticeService } from "../../services/zoho-artwork-notice.service.js";
import { createZohoWebhookRoutes } from "./zoho.js";

const SECRET = "zoho-notice-secret-0123456789-abcdef"; // gitleaks:allow

function makeApp(secret: string | null = SECRET) {
  const webhookEvents = { tryClaimEvent: vi.fn(async () => ({ claimed: true })) };
  const enqueue = vi.fn(async () => undefined);
  const container = {
    zohoArtworkNoticeService: new ZohoArtworkNoticeService(
      secret ?? undefined,
      webhookEvents as never,
      {
        enqueue,
      },
    ),
  } as unknown as Container;
  const app = new Hono();
  app.route("/webhooks/zoho", createZohoWebhookRoutes(container));
  return { app, webhookEvents, enqueue };
}

function post(app: Hono, headers: Record<string, string>, body: string) {
  return app.request("/webhooks/zoho/artworks", { method: "POST", headers, body });
}

describe("POST /webhooks/zoho/artworks", () => {
  it("accepts a notice carrying the secret header", async () => {
    const { app, enqueue } = makeApp();
    const res = await post(
      app,
      { "x-lax-webhook-secret": SECRET, "content-type": "application/json" },
      JSON.stringify({ productId: "5001234567890" }),
    );
    expect(res.status).toBe(202);
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it("rejects a notice without the header", async () => {
    const { app, webhookEvents } = makeApp();
    const res = await post(app, {}, JSON.stringify({ productId: "5001234567890" }));
    expect(res.status).toBe(401);
    expect(webhookEvents.tryClaimEvent).not.toHaveBeenCalled();
  });

  it("does not accept the secret in the query string", async () => {
    const { app } = makeApp();
    const res = await app.request(`/webhooks/zoho/artworks?secret=${SECRET}`, {
      method: "POST",
      body: JSON.stringify({ productId: "5001234567890" }),
    });
    expect(res.status).toBe(401);
  });

  it("answers 503 with an error body when no secret is configured", async () => {
    const { app } = makeApp(null);
    const res = await post(app, { "x-lax-webhook-secret": SECRET }, "{}");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Zoho notices are not configured" });
  });
});
