import { createHash } from "node:crypto";
import { Hono } from "hono";
import type { Container } from "../container.js";
import { verifyXeroWebhookSignature } from "../lib/xero-webhook-signature.js";

type XeroWebhookEvent = {
  tenantId?: string;
  resourceId?: string;
  eventCategory?: string;
  eventType?: string;
  eventDateUtc?: string;
};

type XeroWebhookBody = {
  events?: XeroWebhookEvent[];
};

function eventDedupeKey(ev: XeroWebhookEvent): string {
  const parts = [
    ev.tenantId ?? "",
    ev.resourceId ?? "",
    ev.eventDateUtc ?? "",
    ev.eventType ?? "",
    ev.eventCategory ?? "",
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

export function createXeroWebhookRoutes(container: Container) {
  const r = new Hono();

  r.post("/xero", async (c) => {
    const key = container.env.XERO_WEBHOOK_KEY;
    if (!key) {
      return c.json({ error: "Webhooks not configured" }, 503);
    }

    const raw = await c.req.text();
    const sig = c.req.header("x-xero-signature");
    if (!verifyXeroWebhookSignature(raw, sig, key)) {
      return c.body(null, 401);
    }

    let body: XeroWebhookBody;
    try {
      body = JSON.parse(raw) as XeroWebhookBody;
    } catch {
      return c.body(null, 400);
    }

    const events = body.events ?? [];
    for (const ev of events) {
      if (!ev.tenantId || !ev.resourceId) continue;
      if (String(ev.eventCategory).toUpperCase() !== "INVOICE") continue;

      const eventKey = eventDedupeKey(ev);
      const { claimed } = await container.xeroWebhookEventRepository.tryClaimEvent({
        tenantId: ev.tenantId,
        resourceType: "INVOICE",
        resourceId: ev.resourceId,
        eventKey,
      });
      if (!claimed) {
        continue;
      }

      try {
        const sync = await container.accountingProvider.syncInvoiceFromProvider(
          ev.tenantId,
          ev.resourceId,
        );
        if (!sync.ok) {
          await container.xeroWebhookEventRepository.markFailed(
            eventKey,
            sync.error ?? "sync failed",
          );
        } else {
          await container.xeroWebhookEventRepository.markProcessed(eventKey);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await container.xeroWebhookEventRepository.markFailed(eventKey, msg);
      }
    }

    return c.body(null, 200);
  });

  return r;
}
