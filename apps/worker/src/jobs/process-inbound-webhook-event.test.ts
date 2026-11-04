import { describe, expect, it, vi } from "vitest";
import { processInboundWebhookEvent } from "./process-inbound-webhook-event.js";

describe("processInboundWebhookEvent", () => {
  it("no-ops when WEBHOOK_EVENTS_PROCESS is false", async () => {
    const webhookEvents = {
      recoverStaleClaims: vi.fn(),
      tryClaimForProcessing: vi.fn(),
      markProcessed: vi.fn(),
      markFailed: vi.fn(),
    };

    await processInboundWebhookEvent(
      {
        env: { WEBHOOK_EVENTS_PROCESS: false } as never,
        log: { debug: vi.fn(), info: vi.fn() } as never,
        webhookEvents: webhookEvents as never,
      },
      "event-key",
    );

    expect(webhookEvents.tryClaimForProcessing).not.toHaveBeenCalled();
  });

  it("processes xero invoice webhooks via sync port", async () => {
    const syncXeroInvoiceWebhook = vi.fn().mockResolvedValue(undefined);
    const webhookEvents = {
      recoverStaleClaims: vi.fn(),
      tryClaimForProcessing: vi.fn().mockResolvedValue({
        claimed: true,
        row: {
          source: "xero",
          eventKey: "ek-1",
          payload: {
            body: {},
            routing: {
              tenantId: "tenant-1",
              resourceId: "inv-1",
              eventCategory: "INVOICE",
            },
          },
        },
      }),
      markProcessed: vi.fn(),
      markFailed: vi.fn(),
    };

    await processInboundWebhookEvent(
      {
        env: { WEBHOOK_EVENTS_PROCESS: true } as never,
        log: { debug: vi.fn(), info: vi.fn() } as never,
        webhookEvents: webhookEvents as never,
        syncXeroInvoiceWebhook,
      },
      "ek-1",
    );

    expect(syncXeroInvoiceWebhook).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      resourceId: "inv-1",
      eventKey: "ek-1",
    });
    expect(webhookEvents.markProcessed).toHaveBeenCalledWith("ek-1");
  });

  describe("Zoho artwork notices", () => {
    function zohoEvents(routing: Record<string, unknown>) {
      return {
        recoverStaleClaims: vi.fn(),
        tryClaimForProcessing: vi.fn().mockResolvedValue({
          claimed: true,
          row: { source: "zoho_artwork", eventKey: "zk-1", payload: { body: routing, routing } },
        }),
        markProcessed: vi.fn(),
        markFailed: vi.fn(),
      };
    }
    const base = {
      env: { WEBHOOK_EVENTS_PROCESS: true } as never,
      log: { debug: vi.fn(), info: vi.fn() } as never,
    };

    it("hands the Product to the Zoho artwork processor and marks the notice processed", async () => {
      const processZohoArtworkNotice = vi.fn().mockResolvedValue(undefined);
      const webhookEvents = zohoEvents({ productId: "5001234567890" });
      await processInboundWebhookEvent(
        { ...base, webhookEvents: webhookEvents as never, processZohoArtworkNotice },
        "zk-1",
      );
      expect(processZohoArtworkNotice).toHaveBeenCalledWith({
        productId: "5001234567890",
        eventKey: "zk-1",
      });
      expect(webhookEvents.markProcessed).toHaveBeenCalledWith("zk-1");
    });

    it("marks the notice failed and rethrows so the retry and Failed jobs path takes over", async () => {
      const processZohoArtworkNotice = vi.fn().mockRejectedValue(new Error("zoho_crm_http_503"));
      const webhookEvents = zohoEvents({ productId: "5001234567890" });
      await expect(
        processInboundWebhookEvent(
          { ...base, webhookEvents: webhookEvents as never, processZohoArtworkNotice },
          "zk-1",
        ),
      ).rejects.toThrow("zoho_crm_http_503");
      expect(webhookEvents.markFailed).toHaveBeenCalledWith("zk-1", "zoho_crm_http_503");
      expect(webhookEvents.markProcessed).not.toHaveBeenCalled();
    });

    it("fails a notice with no product id", async () => {
      const webhookEvents = zohoEvents({});
      await expect(
        processInboundWebhookEvent(
          { ...base, webhookEvents: webhookEvents as never, processZohoArtworkNotice: vi.fn() },
          "zk-1",
        ),
      ).rejects.toThrow("missing productId");
      expect(webhookEvents.markFailed).toHaveBeenCalled();
    });
  });
});
