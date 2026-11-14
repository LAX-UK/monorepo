import { Hono } from "hono";
import type { ContainerXeroWebhookRoutesSlice } from "../container.js";
import { asHttpStatus } from "../lib/http-status.js";
import { ZOHO_BOOKS_SIGNATURE_HEADER } from "../lib/zoho-books-notice-signature.js";

/**
 * Signed notices from a Zoho Books workflow (`POST /webhooks/zoho-books/notices`). Every answer
 * has no body and is never cached.
 */
export function createZohoBooksWebhookRoutes(container: ContainerXeroWebhookRoutesSlice) {
  const r = new Hono();

  r.post("/zoho-books/notices", async (c) => {
    const raw = await c.req.text();
    const params = [...new URL(c.req.url).searchParams.entries()];
    const response = await container.finance.zohoBooksNotices.handle({
      rawBody: raw,
      params,
      signature: c.req.header(ZOHO_BOOKS_SIGNATURE_HEADER),
    });
    c.header("Cache-Control", "no-store");
    return c.body(null, asHttpStatus(response.status));
  });

  return r;
}
