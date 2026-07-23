import { afterEach, describe, expect, it, vi } from "vitest";
import { DrizzleAdminUserReader } from "./drizzle-admin-user.reader.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DrizzleAdminUserReader.summarize", () => {
  it("returns filter-scoped summary dimensions including staff roles", async () => {
    const where = vi.fn().mockResolvedValue([
      {
        total: 5,
        active: 4,
        suspended: 1,
        emailVerified: 3,
        kycVerified: 2,
        legacyStaffRole: 0,
        role_super_admin: 1,
        role_auction_manager: 2,
        role_catalogue_manager: 0,
        role_specialist: 0,
        role_finance_ops: 0,
        role_operations_fulfilment: 0,
        role_content_marketing: 0,
        role_support_concierge: 0,
        role_staff_viewer: 0,
        role_compliance_officer: 0,
        role_client_advisor: 0,
        role_operations: 0,
      },
    ]);
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    const reader = new DrizzleAdminUserReader({ select } as never);

    const summary = await reader.summarize({
      limit: 25,
      offset: 0,
      role: "staff",
    });

    expect(summary.total).toBe(5);
    expect(summary.byStaffRole.super_admin).toBe(1);
    expect(summary.byStaffRole.auction_manager).toBe(2);
    expect(where).toHaveBeenCalledOnce();
  });
});
