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
});
