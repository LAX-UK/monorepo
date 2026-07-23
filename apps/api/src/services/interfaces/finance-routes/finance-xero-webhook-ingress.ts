import type { FinanceHttpJson } from "./finance-route-http.js";

export interface IXeroWebhookIngressApplicationService {
  handleInvoiceWebhook(rawBody: string, signature: string | undefined): Promise<FinanceHttpJson>;
}
