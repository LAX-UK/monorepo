import { Hono } from "hono";
import { asHttpStatus } from "../../lib/http-status.js";
import type { PlatformWordPressWebhookRoutesContainer } from "../../services/interfaces/platform-inbound-webhooks/index.js";

export function createWordPressWebhookRoutes(container: PlatformWordPressWebhookRoutesContainer) {
  const r = new Hono();

  r.post("/", async (c) => {
    const raw = await c.req.text();
    const result = await container.platformInboundWebhooks.wordpress.handleWebhook({
      rawBody: raw,
      signature: c.req.header("x-lax-signature"),
      event: c.req.header("x-lax-event"),
    });
    if (result.body === null) {
      return c.body(null, asHttpStatus(result.status));
    }
    return c.json(result.body, asHttpStatus(result.status));
  });

  return r;
}
