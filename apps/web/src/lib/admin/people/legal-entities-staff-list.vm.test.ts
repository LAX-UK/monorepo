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
  legalEntitiesViews,
  legalEntityPanelHref,
  legalEntityRecordHref,
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
    expect(legalEntityPanelHref(search, "le_2")).toBe(
      "/admin/legal-entities?q=gallery&offset=50&entity=le_2&stripe=1",
    );
    expect(legalEntityPanelHref(search, null)).toBe(
      "/admin/legal-entities?q=gallery&offset=50&stripe=1",
    );
  });

  it("links to the record page and remembers the list it came from", () => {
    const href = legalEntityRecordHref({ q: "gallery" }, "le_1");
    expect(href).toBe(
      "/admin/legal-entities/le_1?returnTo=%2Fadmin%2Flegal-entities%3Fq%3Dgallery",
    );
    expect(legalEntityRecordHref({}, "le_1", "stripe")).toBe(
      "/admin/legal-entities/le_1?returnTo=%2Fadmin%2Flegal-entities&tab=stripe",
    );
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
      ["“gallery”", "/admin/legal-entities?status=approved&kind=organisation&stripe=1"],
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
