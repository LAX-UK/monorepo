import type { AdminXeroIntegrationStatus } from "@/lib/data/http/admin.server";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { XeroIntegrationPanel, xeroHealth } from "./xero-integration-panel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/integrations/xero",
  useSearchParams: () => new URLSearchParams(),
}));

const connected: AdminXeroIntegrationStatus = {
  connected: true,
  tenantId: "8f0c2a4e-1b2c-4d5e-9f00-123456789abc",
  tenantName: "London Auction Xchange",
  expiresAt: "2026-10-26T10:30:00.000Z",
  oauthConfigured: true,
  connectedAt: "2026-09-01T09:00:00.000Z",
  updatedAt: "2026-10-26T10:00:00.000Z",
  connectedBy: { id: "u1", name: "Sam Reed", email: "sam.reed@lax.bid" },
  scopes: "accounting.transactions offline_access",
  webhookConfigured: true,
  webhookUrl: "https://api.lax.bid/webhooks/xero",
  recentWebhookErrors: 0,
  syncErrorCount: 0,
  health: "healthy",
  connectionStatus: "healthy",
  lastRefreshError: null,
  orgShortCode: "!a1b2c",
  orgBaseCurrency: "GBP",
};

const noop = async () => {};

describe("xeroHealth", () => {
  it("names the state in words", () => {
    expect(xeroHealth(connected)).toEqual({ label: "Connected", tone: "success" });
    expect(xeroHealth({ ...connected, connected: false })).toEqual({
      label: "Not connected",
      tone: "neutral",
    });
    expect(xeroHealth({ ...connected, connectionStatus: "needs_reauth" }).label).toBe(
      "Needs reconnecting",
    );
  });
});

describe("XeroIntegrationPanel", () => {
  it("offers Connect as the one action when not connected", () => {
    render(
      <StaffTooltipProvider>
        <XeroIntegrationPanel
          status={{ ...connected, connected: false, tenantId: null }}
          oauthStartAction={noop}
          disconnectAction={noop}
        />
      </StaffTooltipProvider>,
    );
    expect(screen.getByRole("button", { name: "Connect Xero" })).toBeTruthy();
    expect(screen.queryByText("Tenant ID")).toBeNull();
  });

  it("shows the tenant ID as a copyable fact and keeps Disconnect out of the header", () => {
    render(
      <StaffTooltipProvider>
        <XeroIntegrationPanel status={connected} oauthStartAction={noop} disconnectAction={noop} />
      </StaffTooltipProvider>,
    );
    expect(screen.getByText("Tenant ID")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /copy/i }).length).toBe(2);
    expect(screen.queryByRole("button", { name: "Disconnect Xero" })).toBeNull();
  });
});
