export type PlatformInboundWebhookHttpResult = {
  status: 200 | 401 | 503;
  body: { error: string } | null;
};

export type ShopifyWebhookIngressInput = {
  rawBody: string;
  hmacSha256: string | undefined;
  topic: string | undefined;
  webhookId: string | undefined;
};

export interface IShopifyWebhookIngressApplicationService {
  handleWebhook(input: ShopifyWebhookIngressInput): Promise<PlatformInboundWebhookHttpResult>;
}
