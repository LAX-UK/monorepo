import { Hono } from "hono";
import type { ContainerXeroWebhookRoutesSlice } from "../container.js";
import { respondFinanceHttpJson } from "../lib/finance-route-response.js";
import { asHttpStatus } from "../lib/http-status.js";

export function createXeroWebhookRoutes(container: ContainerXeroWebhookRoutesSlice) {
  const r = new Hono();

  r.post("/xero", async (c) => {
    const raw = await c.req.text();
    const sig = c.req.header("x-xero-signature");
    const response = await container.finance.xeroWebhooks.handleInvoiceWebhook(raw, sig);
    if (response.body === null) {
      return c.body(null, asHttpStatus(response.status));
    }
    return respondFinanceHttpJson(c, response);
  });

  return r;
}
