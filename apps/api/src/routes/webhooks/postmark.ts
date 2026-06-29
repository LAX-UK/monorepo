import { Hono } from "hono";
import type { Container } from "../../container.js";
import type { PostmarkWebhookPayload } from "../../services/postmark-webhook.service.js";

let warnedMissingAuth = false;

export function createPostmarkWebhookRoutes(container: Container) {
  const r = new Hono();

  r.post("/", async (c) => {
    if (!container.env.POSTMARK_WEBHOOK_BASIC_AUTH && container.env.NODE_ENV === "production") {
      return c.json({ error: "postmark_webhook_not_configured" }, 503);
    }
    if (!isAuthorized(c.req.header("authorization"), container.env.POSTMARK_WEBHOOK_BASIC_AUTH)) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const payload = (await c.req.json().catch(() => ({}))) as PostmarkWebhookPayload;
    await container.postmarkWebhookService.handle(payload);

    return c.json({ ok: true });
  });

  return r;
}

function isAuthorized(header: string | undefined, expected: string | undefined): boolean {
  if (!expected) {
    if (process.env.NODE_ENV === "production") return false;
    if (!warnedMissingAuth) {
      warnedMissingAuth = true;
      console.warn(
        "POSTMARK_WEBHOOK_BASIC_AUTH is unset; accepting Postmark webhook in non-production",
      );
    }
    return true;
  }
  if (!header?.startsWith("Basic ")) return false;
  const value = Buffer.from(header.slice("Basic ".length), "base64").toString("utf8");
  return value === expected;
}
