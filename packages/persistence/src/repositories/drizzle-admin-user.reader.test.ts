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
        role_administrator: 1,
        role_sales_manager: 2,
        role_saleroom_clerk: 0,
        role_cataloguer: 0,
        role_specialist: 0,
        role_client_services: 0,
        role_finance: 0,
        role_fulfilment: 0,
        role_compliance: 0,
        role_read_only: 0,
      },
    ]);
    const leftJoin = vi.fn().mockReturnValue({ where });
    const from = vi.fn().mockReturnValue({ leftJoin });
    const select = vi.fn().mockReturnValue({ from });
    const reader = new DrizzleAdminUserReader({ select } as never);

    const summary = await reader.summarize({
      limit: 25,
      offset: 0,
      role: "staff",
    });

    expect(summary.total).toBe(5);
    expect(summary.byStaffRole.administrator).toBe(1);
    expect(summary.byStaffRole.sales_manager).toBe(2);
    expect(where).toHaveBeenCalledOnce();
  });
});
