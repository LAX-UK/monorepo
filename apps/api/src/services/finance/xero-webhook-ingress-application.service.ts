import { createHash } from "node:crypto";
import type {
  IWebhookEventRepository,
  IXeroWebhookEventRepository,
} from "@auction/persistence/interfaces";
import type { WebhookEventsQueueProducer } from "@auction/queues";
import type { Env } from "../../env.js";
import { verifyXeroWebhookSignature } from "../../lib/xero-webhook-signature.js";
import type { FinanceHttpJson } from "../interfaces/finance-routes/finance-route-http.js";
import type { IXeroWebhookIngressApplicationService } from "../interfaces/finance-routes/finance-xero-webhook-ingress.js";
import type { IInvoiceAccountingProvider } from "../interfaces/invoice-accounting.js";

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

export type XeroWebhookStoredPayload = {
  body: XeroWebhookBody;
  routing: {
    tenantId?: string;
    resourceId?: string;
    eventCategory?: string;
    eventType?: string;
    eventDateUtc?: string;
  };
};

export function xeroWebhookEventDedupeKey(ev: XeroWebhookEvent): string {
  const parts = [
    ev.tenantId ?? "",
    ev.resourceId ?? "",
    ev.eventDateUtc ?? "",
    ev.eventType ?? "",
    ev.eventCategory ?? "",
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

export class XeroWebhookIngressApplicationService implements IXeroWebhookIngressApplicationService {
  constructor(
    private readonly env: Pick<Env, "XERO_WEBHOOK_KEY" | "XERO_WEBHOOK_INBOX_MODE">,
    private readonly xeroWebhookEventRepository: IXeroWebhookEventRepository,
    private readonly accountingProvider: IInvoiceAccountingProvider,
    private readonly webhookEventRepository: IWebhookEventRepository | null = null,
    private readonly webhookEventsProducer: WebhookEventsQueueProducer | null = null,
  ) {}

  async handleInvoiceWebhook(
    rawBody: string,
    signature: string | undefined,
  ): Promise<FinanceHttpJson> {
    const key = this.env.XERO_WEBHOOK_KEY;
    if (!key) {
      return { status: 503, body: { error: "Webhooks not configured" } };
    }

    if (!verifyXeroWebhookSignature(rawBody, signature, key)) {
      return { status: 401, body: null };
    }

    let body: XeroWebhookBody;
    try {
      body = JSON.parse(rawBody) as XeroWebhookBody;
    } catch {
      return { status: 400, body: null };
    }

    if (this.env.XERO_WEBHOOK_INBOX_MODE === "inbox") {
      return this.handleInboxIngress(body);
    }

    return this.handleLegacyIngress(body);
  }

  private async handleLegacyIngress(body: XeroWebhookBody): Promise<FinanceHttpJson> {
    const events = body.events ?? [];
    for (const ev of events) {
      if (!ev.tenantId || !ev.resourceId) continue;
      if (String(ev.eventCategory).toUpperCase() !== "INVOICE") continue;

      const eventKey = xeroWebhookEventDedupeKey(ev);
      const { claimed } = await this.xeroWebhookEventRepository.tryClaimEvent({
        tenantId: ev.tenantId,
        resourceType: "INVOICE",
        resourceId: ev.resourceId,
        eventKey,
      });
      if (!claimed) {
        continue;
      }

      try {
        const sync = await this.accountingProvider.syncInvoiceFromProvider(
          ev.tenantId,
          ev.resourceId,
        );
        if (!sync.ok) {
          await this.xeroWebhookEventRepository.markFailed(eventKey, sync.error ?? "sync failed");
        } else {
          await this.xeroWebhookEventRepository.markProcessed(eventKey);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await this.xeroWebhookEventRepository.markFailed(eventKey, msg);
      }
    }

    return { status: 200, body: null };
  }

  private async handleInboxIngress(body: XeroWebhookBody): Promise<FinanceHttpJson> {
    if (!this.webhookEventRepository) {
      return { status: 503, body: { error: "Webhook inbox not configured" } };
    }

    const events = body.events ?? [];
    for (const ev of events) {
      if (!ev.tenantId || !ev.resourceId) continue;
      if (String(ev.eventCategory).toUpperCase() !== "INVOICE") continue;

      const eventKey = xeroWebhookEventDedupeKey(ev);
      const routing: XeroWebhookStoredPayload["routing"] = {
        tenantId: ev.tenantId,
        resourceId: ev.resourceId,
      };
      if (ev.eventCategory != null) routing.eventCategory = ev.eventCategory;
      if (ev.eventType != null) routing.eventType = ev.eventType;
      if (ev.eventDateUtc != null) routing.eventDateUtc = ev.eventDateUtc;

      const payload: XeroWebhookStoredPayload = {
        body,
        routing,
      };

      const { claimed } = await this.webhookEventRepository.tryClaimEvent({
        source: "xero",
        eventKey,
        payload,
      });

      if (claimed && this.webhookEventsProducer) {
        await this.webhookEventsProducer.enqueue(eventKey);
      }
    }

    return { status: 200, body: null };
  }
}
