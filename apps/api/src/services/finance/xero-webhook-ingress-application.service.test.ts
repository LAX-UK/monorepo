import { describe, expect, it, vi } from "vitest";
import { XeroWebhookIngressApplicationService } from "./xero-webhook-ingress-application.service.js";

describe("XeroWebhookIngressApplicationService inbox mode", () => {
  it("persists invoice events to webhook_event and enqueues", async () => {
    const webhookTryClaim = vi.fn().mockResolvedValue({ claimed: true });
    const enqueue = vi.fn().mockResolvedValue(undefined);
    const service = new XeroWebhookIngressApplicationService(
      { XERO_WEBHOOK_KEY: "test-key", XERO_WEBHOOK_INBOX_MODE: "inbox" },
      { tryClaimEvent: vi.fn(), markProcessed: vi.fn(), markFailed: vi.fn() } as never,
      { syncInvoiceFromProvider: vi.fn() } as never,
      { tryClaimEvent: webhookTryClaim } as never,
      { enqueue } as never,
    );

    const rawBody = JSON.stringify({
      events: [
        {
          tenantId: "tenant-1",
          resourceId: "inv-1",
          eventCategory: "INVOICE",
          eventType: "UPDATE",
          eventDateUtc: "2026-01-01T00:00:00Z",
        },
      ],
    });

    const key = "test-key";
    const crypto = await import("node:crypto");
    const signature = crypto.createHmac("sha256", key).update(rawBody).digest("base64");

    const res = await service.handleInvoiceWebhook(rawBody, signature);
    expect(res.status).toBe(200);
    expect(webhookTryClaim).toHaveBeenCalledWith(
      expect.objectContaining({ source: "xero", payload: expect.any(Object) }),
    );
    expect(enqueue).toHaveBeenCalled();
  });
});
