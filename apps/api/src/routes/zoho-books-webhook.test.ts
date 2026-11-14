import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { zohoBooksSignature } from "../lib/zoho-books-notice-signature.js";
import { ZohoBooksNoticeIngressApplicationService } from "../services/finance/zoho-books-notice-ingress-application.service.js";
import { createZohoBooksWebhookRoutes } from "./zoho-books-webhook.js";

const SECRET = "books-notice-test-secret-0123456789abcdef"; // gitleaks:allow
const BODY = JSON.stringify({
  organization_id: "20091234567",
  module: "creditnote",
  entity_id: "5000000000777",
});

function appWith(secret: string | undefined) {
  const claims: string[] = [];
  const alerts = { signatureFailed: vi.fn() };
  const service = new ZohoBooksNoticeIngressApplicationService(
    secret,
    {
      tryClaimEvent: async ({ eventKey }: { eventKey: string }) => {
        const claimed = !claims.includes(eventKey);
        if (claimed) claims.push(eventKey);
        return { claimed };
      },
    } as never,
    null,
    alerts,
  );
  const app = new Hono().route(
    "/webhooks",
    createZohoBooksWebhookRoutes({ finance: { zohoBooksNotices: service } } as never),
  );
  return { app, claims, alerts };
}

const post = (app: Hono, signature: string | null, query = "?source=books") =>
  app.request(`/webhooks/zoho-books/notices${query}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(signature ? { "X-Zoho-Webhook-Signature": signature } : {}),
    },
    body: BODY,
  });

describe("POST /webhooks/zoho-books/notices", () => {
  it("accepts a notice signed over its query parameters and raw body", async () => {
    const { app, claims } = appWith(SECRET);
    const res = await post(app, zohoBooksSignature([["source", "books"]], BODY, SECRET));
    expect(res.status).toBe(202);
    expect(await res.text()).toBe("");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(claims).toHaveLength(1);
  });

  it("refuses a signature made without the query parameters", async () => {
    const { app, claims, alerts } = appWith(SECRET);
    const res = await post(app, zohoBooksSignature([], BODY, SECRET));
    expect(res.status).toBe(401);
    expect(alerts.signatureFailed).toHaveBeenCalledWith({ reason: "invalid" });
    expect(claims).toEqual([]);
  });

  it("every refusal has no body and is never cached", async () => {
    for (const [secret, signature, status] of [
      [undefined, zohoBooksSignature([["source", "books"]], BODY, SECRET), 503],
      [SECRET, null, 401],
      [SECRET, "Zm9vYmFy", 401],
    ] as const) {
      const { app } = appWith(secret);
      const res = await post(app, signature);
      expect(res.status).toBe(status);
      expect(await res.text()).toBe("");
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
  });
});
