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
});
