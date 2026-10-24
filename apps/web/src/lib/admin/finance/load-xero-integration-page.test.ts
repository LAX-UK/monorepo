import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAdminXeroIntegrationPage } from "./load-xero-integration-page";

const { getStatus, getNavCounts } = vi.hoisted(() => ({
  getStatus: vi.fn(),
  getNavCounts: vi.fn(),
}));

vi.mock("@/lib/data/http/admin.server", () => ({
  getAdminXeroIntegrationStatus: getStatus,
}));

vi.mock("@/lib/data/http/admin-nav-counts.server", () => ({
  getFinanceAdminNavCounts: getNavCounts,
}));

describe("loadAdminXeroIntegrationPage", () => {
  beforeEach(() => {
    getStatus.mockResolvedValue({ connected: false, tenantName: null });
    getNavCounts.mockResolvedValue({ manualReviewCount: 0, disputesOpen: 0, payoutsFailed: 0 });
  });

  it("decodes search params and loads status", async () => {
    const result = await loadAdminXeroIntegrationPage({ connected: "1" });
    expect(result.connected).toBe(true);
    expect(result.status?.connected).toBe(false);
    expect(result.loadError).toBeNull();
  });

  it("shows a fixed sentence for a callback error code", async () => {
    const result = await loadAdminXeroIntegrationPage({ error: "rejected" });
    expect(result.error).toContain("Start the connection again");
  });

  it("does not show text from the URL that is not a callback error code", async () => {
    const result = await loadAdminXeroIntegrationPage({ error: "Call us on 0123 456 789" });
    expect(result.error).toBe("Xero could not be connected.");
  });
});
