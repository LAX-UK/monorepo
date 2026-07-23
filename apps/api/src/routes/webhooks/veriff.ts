/** Veriff KYC + AML watchlist webhooks (transport delegates to compliance.veriffWebhooks). */
import { Hono } from "hono";
import type { ComplianceVeriffWebhookRoutesContainer } from "../../services/interfaces/compliance-routes/compliance-route-container-slices.js";

function readVeriffWebhookHeaders(c: {
  req: { header: (name: string) => string | undefined };
}): { signature: string | undefined; authClient: string | undefined } {
  return {
    signature: c.req.header("x-hmac-signature") ?? c.req.header("vrf-hmac-signature"),
    authClient: c.req.header("x-auth-client"),
  };
}

export function createVeriffWebhookRoutes(container: ComplianceVeriffWebhookRoutesContainer) {
  const r = new Hono();

  r.post("/decision", async (c) => {
    const raw = await c.req.text();
    const { signature, authClient } = readVeriffWebhookHeaders(c);
    const result = await container.compliance.veriffWebhooks.handleDecisionWebhook({
      rawBody: raw,
      signature,
      authClient,
    });
    return c.json(result.body, result.status);
  });

  r.post("/event", async (c) => {
    const raw = await c.req.text();
    const { signature, authClient } = readVeriffWebhookHeaders(c);
    const result = await container.compliance.veriffWebhooks.handleEventWebhook({
      rawBody: raw,
      signature,
      authClient,
    });
    return c.json(result.body, result.status);
  });

  r.post("/watchlist-screening", async (c) => {
    const raw = await c.req.text();
    const { signature, authClient } = readVeriffWebhookHeaders(c);
    const result = await container.compliance.veriffWebhooks.handleWatchlistWebhook({
      rawBody: raw,
      signature,
      authClient,
    });
    return c.json(result.body, result.status);
  });

  return r;
}
