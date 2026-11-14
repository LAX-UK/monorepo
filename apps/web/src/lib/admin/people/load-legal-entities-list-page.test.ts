import { describe, expect, it, vi } from "vitest";
import {
  loadAdminLegalEntitiesListPage,
  loadLegalEntitiesListIds,
} from "./load-legal-entities-list-page";

const { getPage } = vi.hoisted(() => ({ getPage: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/data/http/admin-legal-entities.reader", () => ({
  getAdminLegalEntitiesPage: getPage,
}));

const summary = {
  total: 40,
  byStatus: {
    lead: 0,
    docs_requested: 0,
    docs_received: 0,
    under_review: 1,
    connect_pending: 0,
    approved: 39,
    restricted: 0,
    rejected: 0,
    archived: 0,
  },
  stripeDueCount: 3,
  byKind: { individual: 5, organisation: 35 },
};

const listRow = {
  id: "le-1",
  displayName: "Gallery",
  status: "approved" as const,
  kind: "organisation" as const,
  subkind: "gallery" as const,
  updatedAt: "2026-10-20T10:00:00.000Z",
  stripeDueCount: 0,
};

describe("loadAdminLegalEntitiesListPage", () => {
  it("returns rows, the directory summary, the sort and paging", async () => {
    getPage.mockResolvedValue({
      rows: [listRow],
      total: 40,
      offset: 25,
      limit: 25,
      summary,
      hasNextPage: true,
    });

    const result = await loadAdminLegalEntitiesListPage({
      stripe: "1",
      offset: "25",
      limit: "25",
    });

    expect(getPage).toHaveBeenCalledWith({ limit: 25, offset: 25, stripeDue: true });
    expect(result.loadError).toBeNull();
    expect(result.view).toBe("stripe");
    expect(result.sort).toEqual({ columnId: "updated", direction: "desc" });
    expect(result.summary.stripeDueCount).toBe(3);
    expect(result.rows[0]).toMatchObject({ name: "Gallery", kind: "Organisation · Gallery" });
    expect(result).not.toHaveProperty("preview");
    expect(result.pagination).toEqual({
      summary: "26–26 of 40 legal entities",
      prevHref: "/admin/legal-entities?stripe=1&offset=0&limit=25",
      nextHref: "/admin/legal-entities?stripe=1&offset=50&limit=25",
    });
  });

  it("sorts the page by the URL's sort, and gives the pager the same order", async () => {
    getPage.mockResolvedValue({
      rows: [
        { ...listRow, id: "le-b", displayName: "Bravo" },
        { ...listRow, id: "le-a", displayName: "alpha" },
      ],
      total: 2,
      offset: 0,
      limit: 50,
      summary,
      hasNextPage: false,
    });

    const result = await loadAdminLegalEntitiesListPage({ sort: "name" });
    expect(result.rows.map((row) => row.id)).toEqual(["le-a", "le-b"]);
    expect(await loadLegalEntitiesListIds({ sort: "name" })).toEqual(["le-a", "le-b"]);
    expect(await loadLegalEntitiesListIds({ sort: "-name" })).toEqual(["le-b", "le-a"]);
  });

  it("passes search, status and kind to the API", async () => {
    getPage.mockResolvedValue({
      rows: [],
      total: 0,
      offset: 0,
      limit: 50,
      summary,
      hasNextPage: false,
    });

    await loadAdminLegalEntitiesListPage({
      q: "gallery",
      status: "approved",
      kind: "organisation",
    });

    expect(getPage).toHaveBeenCalledWith({
      limit: 50,
      offset: 0,
      q: "gallery",
      status: "approved",
      kind: "organisation",
    });
  });

  it("contains list failures in plain language, without the raw error", async () => {
    getPage.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.1:443"));

    const result = await loadAdminLegalEntitiesListPage({ q: "gallery" });

    expect(result.loadError).toBe("We could not load legal entities. Try again in a moment.");
    expect(result.rows).toEqual([]);
    expect(result.summary.total).toBe(0);
  });

  it("says plainly when the viewer has no access", async () => {
    getPage.mockRejectedValue(new Error("forbidden"));
    const result = await loadAdminLegalEntitiesListPage({});
    expect(result.loadError).toBe("You do not have access to legal entities.");
  });
});
