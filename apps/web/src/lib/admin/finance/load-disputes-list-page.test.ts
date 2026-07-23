import { describe, expect, it, vi } from "vitest";
import { loadAdminDisputesListPage } from "./load-disputes-list-page";

const { getPage } = vi.hoisted(() => ({ getPage: vi.fn() }));

vi.mock("@/lib/admin/admin-list-controllers", () => ({
  disputesListController: {
    parseQuery: (sp: Record<string, string | undefined>) => ({
      status: sp.status,
      limit: Number(sp.limit ?? 25),
      offset: Number(sp.offset ?? 0),
    }),
  },
}));
vi.mock("@/lib/data/http/disputes.server", () => ({
  getAdminDisputesPage: getPage,
}));
vi.mock("@/lib/query/get-query-client", () => ({
  getQueryClient: () => ({ setQueryData: vi.fn() }),
}));
describe("loadAdminDisputesListPage", () => {
  it("contains list failures and preserves the page model", async () => {
    getPage.mockRejectedValue(new Error("Disputes unavailable"));

    const result = await loadAdminDisputesListPage({ status: "open" });

    expect(result.loadError).toBe("Disputes unavailable");
    expect(result.rows).toEqual([]);
    expect(result.model.hasFilters).toBe(true);
  });
});
