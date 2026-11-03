import type { IWebhookEventRepository } from "@auction/persistence/interfaces";
import {
  type WebhookEventsQueueProducer,
  ZOHO_ARTWORK_WEBHOOK_SOURCE,
  type ZohoArtworkNoticeRouting,
  zohoArtworkNoticeEventKey,
} from "@auction/queues";
import { sharedSecretMatches } from "../lib/shared-secret.js";

export type ZohoArtworkNoticeResponse = {
  status: 202 | 400 | 401 | 503;
  body: { error?: string } | null;
};

/** Zoho record ids are long numbers sent as text. */
const ZOHO_ID = /^\d{5,25}$/;

type ParsedNotice = ZohoArtworkNoticeRouting | null;

function parseNotice(rawBody: string): ParsedNotice {
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (typeof json !== "object" || json === null) return null;
  const record = json as Record<string, unknown>;
  const productId =
    typeof record.productId === "number" ? String(record.productId) : record.productId;
  if (typeof productId !== "string" || !ZOHO_ID.test(productId.trim())) return null;

  const routing: ZohoArtworkNoticeRouting = { productId: productId.trim() };
  if (typeof record.modifiedTime === "string") {
    const when = new Date(record.modifiedTime);
    // Stored as one spelling, so the same change keyed twice is recognised however Zoho wrote it.
    if (!Number.isNaN(when.getTime())) routing.modifiedTime = when.toISOString();
  }
  return routing;
}

/**
 * Receives the notice a Zoho workflow sends when an artwork Product changes. The notice proves
 * itself with a shared secret, is stored durably before anything else, and is queued for the
 * worker, which reads the Product from Zoho. The reply is quick and says nothing about the
 * Product, so a notice that arrives twice, or late, changes nothing.
 */
export class ZohoArtworkNoticeService {
  constructor(
    private readonly secret: string | undefined,
    private readonly webhookEvents: IWebhookEventRepository,
    private readonly producer: WebhookEventsQueueProducer | null,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async handle(
    providedSecret: string | undefined,
    rawBody: string,
  ): Promise<ZohoArtworkNoticeResponse> {
    if (!this.secret) return { status: 503, body: { error: "Zoho notices are not configured" } };
    if (!sharedSecretMatches(providedSecret, this.secret)) return { status: 401, body: null };

    const routing = parseNotice(rawBody);
    if (!routing) return { status: 400, body: { error: "Expected a JSON body with a productId" } };

    const eventKey = zohoArtworkNoticeEventKey(routing, this.now());
    const { claimed } = await this.webhookEvents.tryClaimEvent({
      source: ZOHO_ARTWORK_WEBHOOK_SOURCE,
      eventKey,
      payload: { body: routing, routing },
    });

    if (claimed && this.producer) {
      try {
        await this.producer.enqueue(eventKey);
      } catch {
        // The notice is stored; the worker's drain picks up anything not queued.
      }
    }
    return { status: 202, body: null };
  }
}
