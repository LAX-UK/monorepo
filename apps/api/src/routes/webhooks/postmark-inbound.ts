import { Hono } from "hono";
import type { ContainerPostmarkInboundRoutesSlice } from "../../container.js";
import { createBaseLogger } from "../../lib/logger.js";
import { sharedSecretMatches } from "../../lib/shared-secret.js";
import { inboundPayloadSchema } from "../../services/marketing-enquiry/enquiry-inbound-reply.service.js";

/**
 * Postmark's inbound payload carries every attachment base64-encoded; Postmark itself accepts
 * mail up to about 35 MB. Anything larger than this is refused before it is read.
 */
export const INBOUND_WEBHOOK_MAX_BYTES = 40 * 1024 * 1024;

/** Postmark sends the credentials of the webhook URL as Basic Auth. Unlike the delivery webhook there is no open mode: a missing secret refuses everything. */
function isAuthorized(header: string | undefined, expected: string): boolean {
  if (!header?.startsWith("Basic ")) return false;
  const value = Buffer.from(header.slice("Basic ".length), "base64").toString("utf8");
  return sharedSecretMatches(value, expected);
}

/**
 * `POST /webhooks/postmark/inbound`: a sender's emailed reply to an enquiry email. Separate from
 * the delivery-event route and from its credentials. While `ENQUIRY_INBOUND_REPLIES_ENABLED` is
 * off the route does not exist (404).
 */
export function createPostmarkInboundWebhookRoutes(container: ContainerPostmarkInboundRoutesSlice) {
  const r = new Hono();
  const log = createBaseLogger(container.env);

  r.post("/", async (c) => {
    const { env, enquiryInboundReplies } = container;
    if (!env.ENQUIRY_INBOUND_REPLIES_ENABLED || !enquiryInboundReplies) {
      return c.json({ error: "Not found" }, 404);
    }
    const expected = env.POSTMARK_INBOUND_WEBHOOK_BASIC_AUTH;
    if (!expected) return c.json({ error: "postmark_inbound_not_configured" }, 503);
    if (!isAuthorized(c.req.header("authorization"), expected)) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const declared = Number(c.req.header("content-length") ?? "0");
    if (Number.isFinite(declared) && declared > INBOUND_WEBHOOK_MAX_BYTES) {
      return c.json({ error: "payload_too_large" }, 413);
    }
    const raw = await c.req.text();
    if (raw.length > INBOUND_WEBHOOK_MAX_BYTES) {
      return c.json({ error: "payload_too_large" }, 413);
    }
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return c.json({ error: "invalid_json" }, 400);
    }
    const parsed = inboundPayloadSchema.safeParse(json);
    if (!parsed.success) return c.json({ error: "invalid_payload" }, 400);

    const result = await enquiryInboundReplies.handle(parsed.data);
    // Ids and outcome codes only: never an address, subject or any text of the mail.
    log.info(
      {
        outcome: result.outcome,
        ...(result.outcome === "quarantined" ? { reason: result.reason } : {}),
        ...(result.outcome === "stored" ? { enquiryId: result.enquiryId } : {}),
      },
      "enquiry inbound mail handled",
    );
    return c.json({ ok: true, outcome: result.outcome });
  });

  return r;
}
