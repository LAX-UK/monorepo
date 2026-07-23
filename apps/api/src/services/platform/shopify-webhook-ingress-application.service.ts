import { createHash } from "node:crypto";
import type { IWebhookEventRepository } from "@auction/persistence/interfaces";
import type { WebhookEventsQueueProducer } from "@auction/queues";
import type { Env } from "../../env.js";
import { verifyShopifyHmac } from "../../lib/shopify-hmac.js";
import type {
  IShopifyWebhookIngressApplicationService,
  PlatformInboundWebhookHttpResult,
  ShopifyWebhookIngressInput,
} from "../interfaces/platform-inbound-webhooks/platform-shopify-webhook-ingress.js";

export type WebhookEventStoredPayload = {
  body: Record<string, unknown>;
  routing: {
    topic?: string;
    webhookId?: string;
    eventName?: string;
  };
};

export class ShopifyWebhookIngressApplicationService
  implements IShopifyWebhookIngressApplicationService
{
  constructor(
    private readonly env: Pick<Env, "SHOPIFY_WEBHOOK_SECRET">,
    private readonly webhookEventRepository: IWebhookEventRepository,
    private readonly webhookEventsProducer: WebhookEventsQueueProducer | null = null,
  ) {}

  async handleWebhook(
    input: ShopifyWebhookIngressInput,
  ): Promise<PlatformInboundWebhookHttpResult> {
    const secret = this.env.SHOPIFY_WEBHOOK_SECRET;
    if (!secret) {
      return { status: 503, body: { error: "Shopify webhooks not configured" } };
    }

    if (!verifyShopifyHmac(input.rawBody, input.hmacSha256, secret)) {
      return { status: 401, body: null };
    }

    const eventKey = createHash("sha256")
      .update(["shopify", input.topic ?? "", input.webhookId ?? "", input.rawBody].join("|"))
      .digest("hex");

    const body = JSON.parse(input.rawBody) as Record<string, unknown>;
    const routing: WebhookEventStoredPayload["routing"] = {};
    if (input.topic != null) routing.topic = input.topic;
    if (input.webhookId != null) routing.webhookId = input.webhookId;
    const payload: WebhookEventStoredPayload = {
      body,
      routing,
    };
    const { claimed } = await this.webhookEventRepository.tryClaimEvent({
      source: "shopify",
      eventKey,
      payload,
    });

    if (claimed && this.webhookEventsProducer) {
      await this.webhookEventsProducer.enqueue(eventKey);
    }

    return { status: 200, body: null };
  }
}
