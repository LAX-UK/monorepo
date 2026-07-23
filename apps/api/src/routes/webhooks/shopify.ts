import { Hono } from "hono";
import { asHttpStatus } from "../../lib/http-status.js";
import type { PlatformShopifyWebhookRoutesContainer } from "../../services/interfaces/platform-inbound-webhooks/index.js";

export function createShopifyWebhookRoutes(container: PlatformShopifyWebhookRoutesContainer) {
  const r = new Hono();

  r.post("/", async (c) => {
    const raw = await c.req.text();
    const result = await container.platformInboundWebhooks.shopify.handleWebhook({
      rawBody: raw,
      hmacSha256: c.req.header("x-shopify-hmac-sha256"),
      topic: c.req.header("x-shopify-topic"),
      webhookId: c.req.header("x-shopify-webhook-id"),
    });
    if (result.body === null) {
      return c.body(null, asHttpStatus(result.status));
    }
    return c.json(result.body, asHttpStatus(result.status));
  });

  return r;
}
