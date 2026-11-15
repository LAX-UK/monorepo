import type { IWebhookEventRepository } from "@auction/persistence/interfaces";
import {
  type WebhookEventsQueueProducer,
  ZOHO_QC_MODULES,
  ZOHO_QC_WEBHOOK_SOURCE,
  type ZohoQcModule,
  type ZohoQcNoticeRouting,
  zohoQcNoticeEventKey,
} from "@auction/queues";
import { sharedSecretMatches } from "../lib/shared-secret.js";

export type ZohoQcNoticeResponse = {
  status: 202 | 400 | 401 | 503;
  body: { error?: string } | null;
};

/** How far ahead of the API's clock a notice's modified time may be (clock skew, not a future). */
const MODIFIED_TIME_SKEW_MS = 5 * 60_000;

/** Zoho record ids are long numbers sent as text. */
const ZOHO_ID = /^\d{5,25}$/;

function parseNotice(rawBody: string, now: Date): ZohoQcNoticeRouting | null {
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (typeof json !== "object" || json === null) return null;
  const record = json as Record<string, unknown>;
  const module = record.module;
  const id = typeof record.recordId === "number" ? String(record.recordId) : record.recordId;
  if (!(ZOHO_QC_MODULES as readonly unknown[]).includes(module)) return null;
  if (typeof id !== "string" || !ZOHO_ID.test(id.trim())) return null;

  const routing: ZohoQcNoticeRouting = { module: module as ZohoQcModule, recordId: id.trim() };
  if (typeof record.modifiedTime === "string") {
    const when = new Date(record.modifiedTime);
    if (!Number.isNaN(when.getTime())) {
      // A time in the future would make the worker retry the notice until it gives up.
      if (when.getTime() > now.getTime() + MODIFIED_TIME_SKEW_MS) return null;
      routing.modifiedTime = when.toISOString();
    }
  }
  return routing;
}

/**
 * Receives the notice a Zoho workflow sends when a job's quality check record changes. It carries
 * a shared secret (not a signature: a captured request could be replayed, which is harmless as the
 * worker reads the record from Zoho), is stored durably first, and is queued for the worker, which reads
 * the record from Zoho. The reply says nothing about the record, so a notice that arrives twice,
 * or late, changes nothing.
 */
export class ZohoQcNoticeService {
  constructor(
    private readonly secret: string | undefined,
    private readonly webhookEvents: IWebhookEventRepository,
    private readonly producer: WebhookEventsQueueProducer | null,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async handle(providedSecret: string | undefined, rawBody: string): Promise<ZohoQcNoticeResponse> {
    if (!this.secret) return { status: 503, body: { error: "Zoho notices are not configured" } };
    if (!sharedSecretMatches(providedSecret, this.secret)) return { status: 401, body: null };

    const routing = parseNotice(rawBody, this.now());
    if (!routing) {
      return {
        status: 400,
        body: {
          error:
            "Expected a JSON body with a module, a recordId and a modifiedTime that is not in the future",
        },
      };
    }

    const eventKey = zohoQcNoticeEventKey(routing, this.now());
    const { claimed } = await this.webhookEvents.tryClaimEvent({
      source: ZOHO_QC_WEBHOOK_SOURCE,
      eventKey,
      payload: { body: routing, routing },
    });
    if (claimed && this.producer) {
      try {
        await this.producer.enqueue(eventKey);
      } catch {
        // Stored; the worker's drain picks up anything not queued.
      }
    }
    return { status: 202, body: null };
  }
}
