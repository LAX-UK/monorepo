import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../../container.js";
import { ZohoArtworkNoticeService } from "../../services/zoho-artwork-notice.service.js";
import { ZohoQcNoticeService } from "../../services/zoho-qc-notice.service.js";
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

describe("POST /webhooks/zoho/qc", () => {
  function qcApp(secret: string | null = SECRET) {
    const webhookEvents = { tryClaimEvent: vi.fn(async () => ({ claimed: true })) };
    const enqueue = vi.fn(async () => undefined);
    const container = {
      zohoQcNoticeService: new ZohoQcNoticeService(secret ?? undefined, webhookEvents as never, {
        enqueue,
      }),
    } as unknown as Container;
    const app = new Hono();
    app.route("/webhooks/zoho", createZohoWebhookRoutes(container));
    const send = (headers: Record<string, string>, body: string) =>
      app.request("/webhooks/zoho/qc", { method: "POST", headers, body });
    return { send, webhookEvents, enqueue };
  }
  const body = JSON.stringify({
    module: "Framing_Jobs",
    recordId: "1023341000017963001",
    modifiedTime: "2026-11-14T10:00:00+00:00",
  });

  it("stores and queues a notice that carries the secret, once for the same change", async () => {
    const { send, webhookEvents, enqueue } = qcApp();
    expect((await send({ "x-lax-webhook-secret": SECRET }, body)).status).toBe(202);
    expect((await send({ "x-lax-webhook-secret": SECRET }, body)).status).toBe(202);
    const keys = (
      webhookEvents.tryClaimEvent.mock.calls as unknown as [{ eventKey: string }][]
    ).map(([claim]) => claim.eventKey);
    const [first, second] = keys;
    expect(first).toBe(second);
    expect(webhookEvents.tryClaimEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "zoho_qc",
        payload: expect.objectContaining({
          routing: {
            module: "Framing_Jobs",
            recordId: "1023341000017963001",
            modifiedTime: "2026-11-14T10:00:00.000Z",
          },
        }),
      }),
    );
    expect(enqueue).toHaveBeenCalled();
  });

  it("stores nothing without the secret, with a wrong one, or when no secret is configured", async () => {
    const { send, webhookEvents } = qcApp();
    expect((await send({}, body)).status).toBe(401);
    expect((await send({ "x-lax-webhook-secret": "x".repeat(40) }, body)).status).toBe(401);
    expect((await qcApp(null).send({ "x-lax-webhook-secret": SECRET }, body)).status).toBe(503);
    expect(webhookEvents.tryClaimEvent).not.toHaveBeenCalled();
  });

  it("refuses a modified time far in the future, but takes one within clock skew", async () => {
    const { send, webhookEvents } = qcApp();
    const at = (ms: number) =>
      JSON.stringify({
        module: "Framing_Jobs",
        recordId: "1023341000017963001",
        modifiedTime: new Date(Date.now() + ms).toISOString(),
      });
    expect((await send({ "x-lax-webhook-secret": SECRET }, at(24 * 3_600_000))).status).toBe(400);
    expect(webhookEvents.tryClaimEvent).not.toHaveBeenCalled();
    expect((await send({ "x-lax-webhook-secret": SECRET }, at(60_000))).status).toBe(202);
  });

  it("refuses a body naming an unknown module or no record id", async () => {
    const { send, webhookEvents } = qcApp();
    for (const bad of [
      { module: "Deals", recordId: "1023341000017963001" },
      { module: "Framing_Jobs" },
      { module: "Framing_Jobs", recordId: "abc" },
    ]) {
      expect((await send({ "x-lax-webhook-secret": SECRET }, JSON.stringify(bad))).status).toBe(
        400,
      );
    }
    expect(webhookEvents.tryClaimEvent).not.toHaveBeenCalled();
  });
});
