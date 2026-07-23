import { describe, expect, it, vi } from "vitest";
import { loadAdminClientsListPage } from "./load-clients-list-page";

const { getList } = vi.hoisted(() => ({
  getList: vi.fn(),
}));

vi.mock("@/lib/data/http/admin-users.reader", () => ({
  getAdminUserList: getList,
}));

describe("loadAdminClientsListPage", () => {
  it("returns authoritative summary from API meta", async () => {
    getList.mockResolvedValue({
      rows: [{ id: "u1", email: "alice@example.com", name: "Alice" }],
      total: 40,
      offset: 25,
      limit: 25,
      summary: {
        total: 40,
        active: 35,
        suspended: 5,
        emailVerified: 30,
        kycVerified: 20,
      },
      hasNextPage: false,
    });

    const result = await loadAdminClientsListPage({ offset: "25", emailVerified: "1" });

    expect(result.loadError).toBeNull();
    expect(result.summary.active).toBe(35);
    expect(result.model.hasFilters).toBe(true);
    expect(result.model.listQueryParams.role).toBe("client");
  });

  it("contains list failures and preserves the page model", async () => {
    getList.mockRejectedValue(new Error("Clients unavailable"));

    const result = await loadAdminClientsListPage({ q: "alice" });

    expect(result.loadError).toBe("Clients unavailable");
    expect(result.rows).toEqual([]);
    expect(result.summary.total).toBe(0);
    expect(result.model.hasFilters).toBe(true);
  });
});
