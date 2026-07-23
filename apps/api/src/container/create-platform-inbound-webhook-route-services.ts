import type { IWebhookEventRepository } from "@auction/persistence/interfaces";
import type { WebhookEventsQueueProducer } from "@auction/queues";
import type { Env } from "../env.js";
import type { PlatformInboundWebhookRouteServices } from "../services/interfaces/platform-inbound-webhooks/index.js";
import { ShopifyWebhookIngressApplicationService } from "../services/platform/shopify-webhook-ingress-application.service.js";
import { WordPressWebhookIngressApplicationService } from "../services/platform/wordpress-webhook-ingress-application.service.js";

export type CreatePlatformInboundWebhookRouteServicesInput = {
  env: Pick<Env, "SHOPIFY_WEBHOOK_SECRET" | "WORDPRESS_WEBHOOK_SECRET" | "WEBHOOK_EVENTS_ENQUEUE">;
  webhookEventRepository: IWebhookEventRepository;
  webhookEventsProducer?: WebhookEventsQueueProducer | null;
};

export function createPlatformInboundWebhookRouteServices(
  input: CreatePlatformInboundWebhookRouteServicesInput,
): PlatformInboundWebhookRouteServices {
  const enqueue =
    input.env.WEBHOOK_EVENTS_ENQUEUE && input.webhookEventsProducer
      ? input.webhookEventsProducer
      : null;

  return {
    shopify: new ShopifyWebhookIngressApplicationService(
      input.env,
      input.webhookEventRepository,
      enqueue,
    ),
    wordpress: new WordPressWebhookIngressApplicationService(
      input.env,
      input.webhookEventRepository,
      enqueue,
    ),
  };
}
