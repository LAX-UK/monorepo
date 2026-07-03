import { createHash } from "node:crypto";
import { Hono } from "hono";
import type { ContainerInboundWebhookClaimRoutesSlice } from "../../container.js";
import { verifyWordPressSignature } from "../../lib/wordpress-secret.js";

export function createWordPressWebhookRoutes(container: ContainerInboundWebhookClaimRoutesSlice) {
  const r = new Hono();

  r.post("/", async (c) => {
    const secret = container.env.WORDPRESS_WEBHOOK_SECRET;
    if (!secret) return c.json({ error: "WordPress webhooks not configured" }, 503);
    const raw = await c.req.text();
    if (!verifyWordPressSignature(raw, c.req.header("x-lax-signature"), secret)) {
      return c.body(null, 401);
    }
    const eventKey = createHash("sha256")
      .update(["wordpress", c.req.header("x-lax-event") ?? "", raw].join("|"))
      .digest("hex");
    const payload = JSON.parse(raw) as Record<string, unknown>;
    await container.webhookEventRepository.tryClaimEvent({
      source: "wordpress",
      eventKey,
      payload,
    });
    return c.body(null, 200);
  });

  return r;
}
