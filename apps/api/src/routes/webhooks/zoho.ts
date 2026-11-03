import { Hono } from "hono";
import type { ContainerZohoWebhookRoutesSlice } from "../../container.js";
import { asHttpStatus } from "../../lib/http-status.js";

/** Header the Zoho workflow webhook sends its shared secret in. */
export const ZOHO_WEBHOOK_SECRET_HEADER = "x-lax-webhook-secret";

/** Notices from Zoho workflow rules (`POST /webhooks/zoho/artworks`). */
export function createZohoWebhookRoutes(container: ContainerZohoWebhookRoutesSlice) {
  const r = new Hono();

  r.post("/artworks", async (c) => {
    const raw = await c.req.text();
    const response = await container.zohoArtworkNoticeService.handle(
      c.req.header(ZOHO_WEBHOOK_SECRET_HEADER),
      raw,
    );
    if (response.body === null) return c.body(null, asHttpStatus(response.status));
    return c.json(response.body, asHttpStatus(response.status));
  });

  return r;
}
