import { createHash } from "node:crypto";
import { webhookEvent } from "@auction/db/schema";
import { Hono } from "hono";
import type { Container } from "../../container.js";
import { verifyShopifyHmac } from "../../lib/shopify-hmac.js";

export function createShopifyWebhookRoutes(container: Container) {
  const r = new Hono();

  r.post("/", async (c) => {
    const secret = container.env.SHOPIFY_WEBHOOK_SECRET;
    if (!secret) return c.json({ error: "Shopify webhooks not configured" }, 503);
    const raw = await c.req.text();
    const sig = c.req.header("x-shopify-hmac-sha256");
    if (!verifyShopifyHmac(raw, sig, secret)) return c.body(null, 401);

    const eventKey = createHash("sha256")
      .update(
        [
          "shopify",
          c.req.header("x-shopify-topic") ?? "",
          c.req.header("x-shopify-webhook-id") ?? "",
          raw,
        ].join("|"),
      )
      .digest("hex");
    const payload = JSON.parse(raw) as Record<string, unknown>;
    await container.db
      .insert(webhookEvent)
      .values({ source: "shopify", eventKey, payload })
      .onConflictDoNothing();
    return c.body(null, 200);
  });

  return r;
}
