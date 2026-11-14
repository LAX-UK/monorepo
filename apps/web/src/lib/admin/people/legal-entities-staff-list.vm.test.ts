import type {
  AdminLegalEntityListRow,
  AdminLegalEntityListSummary,
} from "@/lib/data/http/admin-legal-entities.shared";
import { describe, expect, it } from "vitest";
import {
  activeLegalEntitiesView,
  legalEntitiesAttention,
  legalEntitiesFilterChips,
  legalEntitiesListHref,
  legalEntitiesMetrics,
  legalEntitiesRangeSummary,
  legalEntitiesSortHref,
  legalEntitiesSortState,
  legalEntitiesViews,
  legalEntityPanelRedirect,
  legalEntityRecordHref,
  sortLegalEntitiesStaffRows,
  toLegalEntitiesStaffRows,
} from "./legal-entities-staff-list.vm";

const summary: AdminLegalEntityListSummary = {
  total: 40,
  byStatus: {
    lead: 1,
    docs_requested: 0,
    docs_received: 2,
    under_review: 3,
    connect_pending: 2,
    approved: 30,
    restricted: 0,
    rejected: 1,
    archived: 1,
  },
  stripeDueCount: 4,
  byKind: { individual: 5, organisation: 35 },
};

const row: AdminLegalEntityListRow = {
  id: "le_1",
  displayName: "Gallery One",
  status: "under_review",
  kind: "organisation",
  subkind: "gallery",
  updatedAt: "2026-10-20T10:00:00.000Z",
  stripeDueCount: 2,
};

describe("legal entities staff list view model", () => {
  it("turns rows into plain data with readable kind and Stripe text", () => {
    const [due, none] = toLegalEntitiesStaffRows([row, { ...row, id: "le_2", stripeDueCount: 0 }]);
    expect(due).toMatchObject({
      name: "Gallery One",
      kind: "Organisation · Gallery",
      stripe: "2 requirements due",
      statusPresentation: { label: "Under review" },
    });
    expect(none?.stripe).toBeNull();
  });

  it("builds list links that drop the open panel and restart paging", () => {
    const search = { q: "gallery", offset: "50", entity: "le_1", stripe: "1" };
    expect(legalEntitiesListHref(search, { status: "approved" })).toBe(
      "/admin/legal-entities?q=gallery&stripe=1&status=approved",
    );
    expect(legalEntitiesListHref(search, { offset: 100 })).toBe(
      "/admin/legal-entities?q=gallery&offset=100&stripe=1",
    );
  });

  it("links to the entity's page and remembers the list it came from", () => {
    expect(legalEntityRecordHref({ q: "gallery", sort: "name" }, "le_1")).toBe(
      "/admin/legal-entities/le_1?list=q%3Dgallery%26sort%3Dname",
    );
    expect(legalEntityRecordHref({}, "le_1")).toBe("/admin/legal-entities/le_1");
    expect(legalEntityRecordHref({ stripe: "1" }, "le_1", "stripe")).toBe(
      "/admin/legal-entities/le_1/stripe?list=stripe%3D1",
    );
    // An old panel param and one-off notices are not part of the list.
    expect(legalEntityRecordHref({ entity: "le_9", success: "Saved" }, "le_1")).toBe(
      "/admin/legal-entities/le_1",
    );
  });

  it("sends an old panel link to the entity's page, still in its list", () => {
    expect(legalEntityPanelRedirect({ stripe: "1", q: "gallery", entity: "le_2" })).toBe(
      "/admin/legal-entities/le_2?list=stripe%3D1%26q%3Dgallery",
    );
    expect(legalEntityPanelRedirect({ entity: "le_2" })).toBe("/admin/legal-entities/le_2");
    expect(legalEntityPanelRedirect({ entity: " " })).toBeNull();
    expect(legalEntityPanelRedirect({ q: "gallery" })).toBeNull();
  });

  it("keeps the sort in the URL, leaving the default out", () => {
    expect(legalEntitiesSortState(undefined)).toEqual({ columnId: "updated", direction: "desc" });
    expect(legalEntitiesSortState("name")).toEqual({ columnId: "name", direction: "asc" });
    expect(legalEntitiesSortState("-kind")).toEqual({ columnId: "updated", direction: "desc" });
    expect(
      legalEntitiesSortHref({ q: "a", offset: "50" }, { columnId: "stripe", direction: "desc" }),
    ).toBe("/admin/legal-entities?q=a&sort=-stripe");
    expect(
      legalEntitiesSortHref({ sort: "name" }, { columnId: "updated", direction: "desc" }),
    ).toBe("/admin/legal-entities");
  });

  it("puts the page of rows in the URL's order", () => {
    const rows = toLegalEntitiesStaffRows([
      {
        ...row,
        id: "a",
        displayName: "beta",
        stripeDueCount: 0,
        updatedAt: "2026-10-01T00:00:00Z",
      },
      {
        ...row,
        id: "b",
        displayName: "Alpha",
        stripeDueCount: 3,
        updatedAt: "2026-10-03T00:00:00Z",
      },
      {
        ...row,
        id: "c",
        displayName: "gamma",
        stripeDueCount: 1,
        updatedAt: "2026-10-02T00:00:00Z",
      },
    ]);
    const ids = (columnId: string, direction: "asc" | "desc") =>
      sortLegalEntitiesStaffRows(rows, { columnId, direction }).map((r) => r.id);
    expect(ids("updated", "desc")).toEqual(["b", "c", "a"]);
    expect(ids("name", "asc")).toEqual(["b", "a", "c"]);
    expect(ids("stripe", "desc")).toEqual(["b", "c", "a"]);
  });

  it("offers All and the Stripe requirements view, with a count only on the work waiting", () => {
    const views = legalEntitiesViews({ status: "approved" }, summary);
    expect(views.map((view) => view.label)).toEqual(["All", "Stripe requirements"]);
    expect(views[1]).toMatchObject({
      count: 4,
      href: "/admin/legal-entities?status=approved&stripe=1",
    });
    expect(legalEntitiesViews({}, { ...summary, stripeDueCount: 0 })[1]?.count).toBeUndefined();
    expect(activeLegalEntitiesView({ stripe: "1" })).toBe("stripe");
    expect(activeLegalEntitiesView({})).toBe("all");
  });

  it("lists the waiting work, leaving out the view the page already shows", () => {
    expect(
      legalEntitiesAttention({}, summary, "all").map((item) => [item.count, item.label]),
    ).toEqual([
      [4, "legal entities have Stripe requirements due"],
      [3, "legal entities are under review"],
    ]);
    expect(legalEntitiesAttention({}, summary, "stripe").map((item) => item.id)).toEqual([
      "review",
    ]);
  });

  it("summarises the directory in four numbers", () => {
    expect(legalEntitiesMetrics(summary).map((metric) => [metric.label, metric.value])).toEqual([
      ["Legal entities", "40"],
      ["Approved", "30"],
      ["In review", "5"],
      ["Stripe requirements due", "4"],
    ]);
  });

  it("shows search, status and kind as chips that each remove only themselves", () => {
    const search = { q: "gallery", status: "approved", kind: "organisation", stripe: "1" };
    expect(legalEntitiesFilterChips(search).map((chip) => [chip.label, chip.clearHref])).toEqual([
      ["Search: gallery", "/admin/legal-entities?status=approved&kind=organisation&stripe=1"],
      ["Status: Approved", "/admin/legal-entities?q=gallery&kind=organisation&stripe=1"],
      ["Kind: Organisation", "/admin/legal-entities?q=gallery&status=approved&stripe=1"],
    ]);
    expect(legalEntitiesFilterChips({ status: "nonsense" })).toEqual([]);
  });

  it("states the range with the total", () => {
    expect(legalEntitiesRangeSummary(0, 50, 312)).toBe("1–50 of 312 legal entities");
    expect(legalEntitiesRangeSummary(0, 1, 1)).toBe("1–1 of 1 legal entity");
  });
});
