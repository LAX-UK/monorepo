import { Hono } from "hono";
import type { ContainerBrevoWebhookRoutesSlice } from "../../container.js";
import type { BrevoWebhookPayload } from "../../services/brevo-webhook-ingest.service.js";

let warnedMissingSecret = false;

/**
 * Brevo marketing-contacts webhook: maps unsubscribe / blocklist / bounce / spam
 * events into `email_suppression` (and `user.email_status` for bounce/complaint), so
 * opt-outs are honored by the contact-sync job and survive a later switch to Zoho.
 */
export function createBrevoWebhookRoutes(container: ContainerBrevoWebhookRoutesSlice) {
  const r = new Hono();

  r.post("/", async (c) => {
    const expected = container.env.BREVO_WEBHOOK_SECRET;
    if (!expected && container.env.NODE_ENV === "production") {
      return c.json({ error: "brevo_webhook_not_configured" }, 503);
    }
    if (!isAuthorized(c, expected)) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const payload = (await c.req.json().catch(() => ({}))) as BrevoWebhookPayload;
    await container.brevoWebhookIngestService.handle(payload);

    return c.json({ ok: true });
  });

  return r;
}

function isAuthorized(
  c: {
    req: { query: (k: string) => string | undefined; header: (k: string) => string | undefined };
  },
  expected: string | undefined,
): boolean {
  if (!expected) {
    if (process.env.NODE_ENV === "production") return false;
    if (!warnedMissingSecret) {
      warnedMissingSecret = true;
      console.warn("BREVO_WEBHOOK_SECRET is unset; accepting Brevo webhook in non-production");
    }
    return true;
  }
  const provided = c.req.query("secret") ?? c.req.header("x-brevo-secret");
  return provided === expected;
}
