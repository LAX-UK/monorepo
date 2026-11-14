import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { ContainerXeroWebhookRoutesSlice } from "../container.js";
import { asHttpStatus } from "../lib/http-status.js";
import { ZOHO_BOOKS_SIGNATURE_HEADER } from "../lib/zoho-books-notice-signature.js";
import { ZOHO_BOOKS_NOTICE_MAX_BYTES } from "../services/finance/zoho-books-notice-ingress-application.service.js";

/**
 * Signed notices from a Zoho Books workflow (`POST /webhooks/zoho-books/notices`). Every answer
 * has no body and is never cached.
 */
export function createZohoBooksWebhookRoutes(container: ContainerXeroWebhookRoutesSlice) {
  const r = new Hono();

  r.post(
    "/zoho-books/notices",
    // A notice is a few ids: a larger body is refused by its declared length, or as it streams in
    // past the limit, before it is ever buffered whole.
    bodyLimit({
      maxSize: ZOHO_BOOKS_NOTICE_MAX_BYTES,
      onError: (c) => {
        c.header("Cache-Control", "no-store");
        return c.body(null, 413);
      },
    }),
    async (c) => {
      const raw = await c.req.text();
      const params = [...new URL(c.req.url).searchParams.entries()];
      const response = await container.finance.zohoBooksNotices.handle({
        rawBody: raw,
        params,
        signature: c.req.header(ZOHO_BOOKS_SIGNATURE_HEADER),
      });
      c.header("Cache-Control", "no-store");
      return c.body(null, asHttpStatus(response.status));
    },
  );

  return r;
}
