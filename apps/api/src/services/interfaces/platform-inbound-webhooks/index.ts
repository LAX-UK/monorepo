export type {
  PlatformInboundWebhookHttpResult,
  ShopifyWebhookIngressInput,
  IShopifyWebhookIngressApplicationService,
} from "./platform-shopify-webhook-ingress.js";
export type {
  WordPressWebhookIngressInput,
  IWordPressWebhookIngressApplicationService,
} from "./platform-wordpress-webhook-ingress.js";

import type { IShopifyWebhookIngressApplicationService } from "./platform-shopify-webhook-ingress.js";
import type { IWordPressWebhookIngressApplicationService } from "./platform-wordpress-webhook-ingress.js";

export type PlatformInboundWebhookRouteServices = {
  shopify: IShopifyWebhookIngressApplicationService;
  wordpress: IWordPressWebhookIngressApplicationService;
};

export type {
  PlatformShopifyWebhookRoutesContainer,
  PlatformWordPressWebhookRoutesContainer,
} from "./platform-inbound-webhook-route-container-slices.js";
