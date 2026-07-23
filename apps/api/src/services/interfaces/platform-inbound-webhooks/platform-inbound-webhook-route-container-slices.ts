import type { PlatformInboundWebhookRouteServices } from "./index.js";

type PlatformInboundWebhookRoutePick<K extends keyof PlatformInboundWebhookRouteServices> = {
  platformInboundWebhooks: Pick<PlatformInboundWebhookRouteServices, K>;
};

export type PlatformShopifyWebhookRoutesContainer = PlatformInboundWebhookRoutePick<"shopify">;
export type PlatformWordPressWebhookRoutesContainer = PlatformInboundWebhookRoutePick<"wordpress">;
