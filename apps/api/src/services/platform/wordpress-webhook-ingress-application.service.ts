import { createHash } from "node:crypto";
import type { IWebhookEventRepository } from "@auction/persistence/interfaces";
import type { WebhookEventsQueueProducer } from "@auction/queues";
import type { Env } from "../../env.js";
import { verifyWordPressSignature } from "../../lib/wordpress-secret.js";
import type { PlatformInboundWebhookHttpResult } from "../interfaces/platform-inbound-webhooks/platform-shopify-webhook-ingress.js";
import type {
  IWordPressWebhookIngressApplicationService,
  WordPressWebhookIngressInput,
} from "../interfaces/platform-inbound-webhooks/platform-wordpress-webhook-ingress.js";
import type { WebhookEventStoredPayload } from "./shopify-webhook-ingress-application.service.js";

export class WordPressWebhookIngressApplicationService
  implements IWordPressWebhookIngressApplicationService
{
  constructor(
    private readonly env: Pick<Env, "WORDPRESS_WEBHOOK_SECRET">,
    private readonly webhookEventRepository: IWebhookEventRepository,
    private readonly webhookEventsProducer: WebhookEventsQueueProducer | null = null,
  ) {}

  async handleWebhook(
    input: WordPressWebhookIngressInput,
  ): Promise<PlatformInboundWebhookHttpResult> {
    const secret = this.env.WORDPRESS_WEBHOOK_SECRET;
    if (!secret) {
      return { status: 503, body: { error: "WordPress webhooks not configured" } };
    }

    if (!verifyWordPressSignature(input.rawBody, input.signature, secret)) {
      return { status: 401, body: null };
    }

    const eventKey = createHash("sha256")
      .update(["wordpress", input.event ?? "", input.rawBody].join("|"))
      .digest("hex");

    const body = JSON.parse(input.rawBody) as Record<string, unknown>;
    const routing: WebhookEventStoredPayload["routing"] = {};
    if (input.event != null) routing.eventName = input.event;
    const payload: WebhookEventStoredPayload = {
      body,
      routing,
    };
    const { claimed } = await this.webhookEventRepository.tryClaimEvent({
      source: "wordpress",
      eventKey,
      payload,
    });

    if (claimed && this.webhookEventsProducer) {
      await this.webhookEventsProducer.enqueue(eventKey);
    }

    return { status: 200, body: null };
  }
}
