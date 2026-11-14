import type { IWebhookEventRepository } from "@auction/persistence/interfaces";
import {
  type WebhookEventsQueueProducer,
  ZOHO_BOOKS_NOTICE_MODULES,
  ZOHO_BOOKS_WEBHOOK_SOURCE,
  type ZohoBooksNoticeModule,
  type ZohoBooksNoticeRouting,
  zohoBooksNoticeEventKey,
} from "@auction/queues";
import { verifyZohoBooksSignature } from "../../lib/zoho-books-notice-signature.js";
import type { FinanceHttpJson } from "../interfaces/finance-routes/finance-route-http.js";
import type {
  IZohoBooksNoticeIngressApplicationService,
  ZohoBooksNoticeRequest,
} from "../interfaces/finance-routes/finance-zoho-books-notice-ingress.js";

/** The accounting alert a refused signature raises (`zoho_books.notice_signature_failed`). */
export interface ZohoBooksNoticeAlerts {
  /** `reason` says only which check failed; nothing from the request is passed on. */
  signatureFailed(fields: { reason: "missing" | "invalid" }): void;
}

/** A notice is a few ids; anything larger is not one, and is refused before it is hashed. */
export const ZOHO_BOOKS_NOTICE_MAX_BYTES = 16 * 1024;

const BOOKS_ID = /^[0-9]{1,32}$/;

/** Every answer has no body: a refusal never says why, an acceptance says nothing about the document. */
const noBody = (status: number): FinanceHttpJson => ({ status, body: null });

function parseRouting(rawBody: string): ZohoBooksNoticeRouting | null {
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (typeof json !== "object" || json === null || Array.isArray(json)) return null;
  const record = json as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "number" ? String(v) : v);
  const organizationId = text(record.organization_id);
  const entityId = text(record.entity_id);
  const module = record.module;
  if (typeof organizationId !== "string" || !BOOKS_ID.test(organizationId)) return null;
  if (typeof entityId !== "string" || !BOOKS_ID.test(entityId)) return null;
  if (
    typeof module !== "string" ||
    !(ZOHO_BOOKS_NOTICE_MODULES as readonly string[]).includes(module)
  ) {
    return null;
  }
  const routing: ZohoBooksNoticeRouting = {
    organizationId,
    module: module as ZohoBooksNoticeModule,
    entityId,
  };
  if (typeof record.event_time === "string") {
    const when = new Date(record.event_time);
    if (!Number.isNaN(when.getTime())) routing.eventTime = when.toISOString();
  }
  return routing;
}

/**
 * Receives a Zoho Books workflow notice. It refuses everything while no secret is configured
 * (fail closed), checks the signature in constant time before reading the body, raises the
 * accounting alert for a signature that is missing or wrong, and stores a good notice once per
 * Books ids in webhook_event. What is stored is Books' ids only: the notice is a hint for the
 * worker to read that document from Books again, and its content is never trusted for money.
 */
export class ZohoBooksNoticeIngressApplicationService
  implements IZohoBooksNoticeIngressApplicationService
{
  constructor(
    private readonly secret: string | undefined,
    private readonly webhookEvents: IWebhookEventRepository | null,
    private readonly producer: WebhookEventsQueueProducer | null,
    private readonly alerts: ZohoBooksNoticeAlerts,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async handle(request: ZohoBooksNoticeRequest): Promise<FinanceHttpJson> {
    if (!this.secret || !this.webhookEvents) return noBody(503);
    if (Buffer.byteLength(request.rawBody, "utf8") > ZOHO_BOOKS_NOTICE_MAX_BYTES) {
      return noBody(413);
    }
    if (!request.signature) {
      this.alerts.signatureFailed({ reason: "missing" });
      return noBody(401);
    }
    if (
      !verifyZohoBooksSignature(request.params, request.rawBody, request.signature, this.secret)
    ) {
      this.alerts.signatureFailed({ reason: "invalid" });
      return noBody(401);
    }

    const routing = parseRouting(request.rawBody);
    if (!routing) return noBody(400);

    const eventKey = zohoBooksNoticeEventKey(routing, this.now());
    const { claimed } = await this.webhookEvents.tryClaimEvent({
      source: ZOHO_BOOKS_WEBHOOK_SOURCE,
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
    return noBody(202);
  }
}
