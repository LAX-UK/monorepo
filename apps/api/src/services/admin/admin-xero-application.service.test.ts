import type {
  IPaymentExternalRefRepository,
  IUserRepository,
  IXeroConnectionRepository,
  IXeroWebhookEventRepository,
  XeroConnectionSummaryRow,
} from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import type { XeroOAuthService } from "../xero-oauth.service.js";
import { AdminXeroApplicationService } from "./admin-xero-application.service.js";

const summary = (tokensReadable: boolean): XeroConnectionSummaryRow =>
  ({
    id: "conn-1",
    tenantId: "tenant-1",
    tenantName: "Org",
    expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    scopes: "accounting.transactions offline_access",
    connectedByUserId: null,
    connectionStatus: "healthy",
    lastRefreshError: null,
    orgShortCode: null,
    orgBaseCurrency: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    tokensReadable,
  }) as XeroConnectionSummaryRow;

function build(row: XeroConnectionSummaryRow | null) {
  const findLatest = vi.fn().mockRejectedValue(new Error("xero_token_sealing_unreadable"));
  const connections = {
    findLatest,
    findLatestSummary: vi.fn().mockResolvedValue(row),
  } as unknown as IXeroConnectionRepository;
  const log = { warn: vi.fn() };
  const service = new AdminXeroApplicationService(
    {} as XeroOAuthService,
    "https://api.example.test/admin/integrations/xero/callback",
    connections,
    { countErrorsSince: vi.fn().mockResolvedValue(0) } as unknown as IXeroWebhookEventRepository,
    { countSyncErrors: vi.fn().mockResolvedValue(0) } as unknown as IPaymentExternalRefRepository,
    { findById: vi.fn().mockResolvedValue(null) } as unknown as IUserRepository,
    { API_PUBLIC_URL: "https://api.example.test", XERO_WEBHOOK_KEY: "k" },
    log,
  );
  return { service, log, findLatest };
}

describe("AdminXeroApplicationService.getStatusPayload", () => {
  it("reports a connection whose saved tokens cannot be read as reconnect required, not an error", async () => {
    const { service, log, findLatest } = build(summary(false));

    const status = await service.getStatusPayload();

    expect(status).toMatchObject({
      connected: false,
      reason: "reconnect_required",
      health: "disconnected",
      oauthConfigured: true,
      tenantId: null,
      webhookUrl: "https://api.example.test/webhooks/xero",
    });
    expect(findLatest).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(log.warn.mock.calls)).not.toMatch(/token\W*[:=]|v1:/i);
  });

  it("warns once, not on every status read", async () => {
    const { service, log } = build(summary(false));
    await service.getStatusPayload();
    await service.getStatusPayload();
    expect(log.warn).toHaveBeenCalledTimes(1);
  });

  it("reports a readable connection as connected with no reason", async () => {
    const { service, log } = build(summary(true));
    await expect(service.getStatusPayload()).resolves.toMatchObject({
      connected: true,
      reason: null,
      tenantId: "tenant-1",
      health: "healthy",
    });
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("reports no connection as not connected with no reason", async () => {
    const { service } = build(null);
    await expect(service.getStatusPayload()).resolves.toMatchObject({
      connected: false,
      reason: null,
    });
  });
});
