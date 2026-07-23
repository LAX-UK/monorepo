import { describe, expect, it, vi } from "vitest";
import { ShopifyWebhookIngressApplicationService } from "./shopify-webhook-ingress-application.service.js";

describe("ShopifyWebhookIngressApplicationService", () => {
  it("stores routing metadata and enqueues after claim", async () => {
    const tryClaimEvent = vi.fn().mockResolvedValue({ claimed: true });
    const enqueue = vi.fn().mockResolvedValue(undefined);
    const service = new ShopifyWebhookIngressApplicationService(
      { SHOPIFY_WEBHOOK_SECRET: "secret" },
      { tryClaimEvent } as never,
      { enqueue },
    );

    const rawBody = JSON.stringify({ id: 123, email: "a@example.com" });
    const crypto = await import("node:crypto");
    const hmac = crypto.createHmac("sha256", "secret").update(rawBody, "utf8").digest("base64");

    const result = await service.handleWebhook({
      rawBody,
      hmacSha256: hmac,
      topic: "customers/create",
      webhookId: "wh-1",
    });

    expect(result.status).toBe(200);
    expect(tryClaimEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "shopify",
        payload: {
          body: { id: 123, email: "a@example.com" },
          routing: { topic: "customers/create", webhookId: "wh-1" },
        },
      }),
    );
    expect(enqueue).toHaveBeenCalledOnce();
  });
});
