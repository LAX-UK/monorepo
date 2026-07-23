export type VeriffWebhookIngressResult = {
  ok: true;
  status: 200;
  body: Record<string, unknown>;
};

export type VeriffWebhookIngressErrorResult = {
  ok: false;
  status: 400 | 401 | 503 | 500;
  body: Record<string, string>;
};

export type VeriffWebhookHttpResult = VeriffWebhookIngressResult | VeriffWebhookIngressErrorResult;

export interface IVeriffWebhookIngressApplicationService {
  handleDecisionWebhook(input: {
    rawBody: string;
    signature: string | undefined;
    authClient: string | undefined;
  }): Promise<VeriffWebhookHttpResult>;
  handleEventWebhook(input: {
    rawBody: string;
    signature: string | undefined;
    authClient: string | undefined;
  }): Promise<VeriffWebhookHttpResult>;
  handleWatchlistWebhook(input: {
    rawBody: string;
    signature: string | undefined;
    authClient: string | undefined;
  }): Promise<VeriffWebhookHttpResult>;
}
