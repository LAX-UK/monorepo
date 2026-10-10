import { describe, expect, it, vi } from "vitest";
import { loadAdminStaffListPage } from "./load-staff-list-page";

const { getList, getSummaries } = vi.hoisted(() => ({
  getList: vi.fn(),
  getSummaries: vi.fn(),
}));

vi.mock("@/lib/data/http/admin-users.reader", () => ({
  getAdminUserList: getList,
}));

vi.mock("@/lib/data/http/staff-access.server", () => ({
  getServerStaffAccessSummaries: getSummaries,
}));

const PAGE = {
  rows: [{ id: "s1", email: "bob@example.com", name: "Bob" }],
  total: 12,
  offset: 0,
  limit: 25,
  summary: { total: 12, active: 10, suspended: 2, emailVerified: 11, kycVerified: 0 },
  hasNextPage: false,
};

describe("loadAdminStaffListPage", () => {
  it("returns authoritative summary from API meta", async () => {
    getList.mockResolvedValue(PAGE);
    const access = {
      s1: { subjectId: "s1", platforms: [], twoFactorEnabled: true, lastSignInAt: null },
    };
    getSummaries.mockResolvedValue(access);

    const result = await loadAdminStaffListPage({ staffRole: "finance_ops" });

    expect(result.loadError).toBeNull();
    expect(result.summary.total).toBe(12);
    expect(result.model.listQueryParams.role).toBe("staff");
    expect(getSummaries).toHaveBeenCalledWith(["s1"]);
    expect(result.access).toEqual(access);
  });

  it("keeps the staff list when cross-platform access cannot be loaded", async () => {
    getList.mockResolvedValue(PAGE);
    getSummaries.mockRejectedValue(new Error("network"));

    const result = await loadAdminStaffListPage({});

    expect(result.loadError).toBeNull();
    expect(result.rows).toHaveLength(1);
    expect(result.access).toEqual({});
  });

  it("contains list failures and preserves the page model", async () => {
    getList.mockRejectedValue(new Error("Staff unavailable"));

    const result = await loadAdminStaffListPage({ q: "bob" });

    expect(result.loadError).toBe("Staff unavailable");
    expect(result.rows).toEqual([]);
    expect(result.summary.total).toBe(0);
  });
});
