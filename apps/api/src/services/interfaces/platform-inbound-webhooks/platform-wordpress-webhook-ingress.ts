import type { PlatformInboundWebhookHttpResult } from "./platform-shopify-webhook-ingress.js";

export type { PlatformInboundWebhookHttpResult };

export type WordPressWebhookIngressInput = {
  rawBody: string;
  signature: string | undefined;
  event: string | undefined;
};

export interface IWordPressWebhookIngressApplicationService {
  handleWebhook(input: WordPressWebhookIngressInput): Promise<PlatformInboundWebhookHttpResult>;
}
