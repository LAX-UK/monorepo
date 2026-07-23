import type { AdminUserListFilter, IAdminUserBrowseReader } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { AdminUserListQueryService } from "./admin-user-list-query.service.js";

describe("AdminUserListQueryService", () => {
  it("returns rows with summary in parallel", async () => {
    const filter: AdminUserListFilter = { limit: 25, offset: 0, q: "alice" };
    const list = vi.fn().mockResolvedValue({
      rows: [{ id: "u1", email: "alice@example.com" }],
      total: 1,
    });
    const summarize = vi.fn().mockResolvedValue({
      total: 1,
      active: 1,
      suspended: 0,
      emailVerified: 1,
      kycVerified: 0,
      byStaffRole: {},
    });
    const users = { list, summarize } as unknown as IAdminUserBrowseReader;
    const service = new AdminUserListQueryService(users);

    const page = await service.getPage(filter);

    expect(list).toHaveBeenCalledWith(filter);
    expect(summarize).toHaveBeenCalledWith(filter);
    expect(page.rows).toHaveLength(1);
    expect(page.total).toBe(1);
    expect(page.limit).toBe(25);
    expect(page.offset).toBe(0);
    expect(page.summary).toEqual({
      total: 1,
      active: 1,
      suspended: 0,
      emailVerified: 1,
      kycVerified: 0,
      byStaffRole: {},
    });
  });
});
