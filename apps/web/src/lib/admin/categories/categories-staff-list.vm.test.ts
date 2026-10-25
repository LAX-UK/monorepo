import type { AdminCategoriesListSummary, AdminCategory } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  assignmentsLabel,
  categoriesActiveView,
  categoriesListHref,
  categoriesMetrics,
  categoriesRangeSummary,
  categoriesViews,
  categoryPanelHref,
  toCategoriesStaffRows,
} from "./categories-staff-list.vm";

function category(patch: Partial<AdminCategory> & { id: string }): AdminCategory {
  return {
    name: "Ceramics",
    slug: "ceramics",
    description: null,
    archived: false,
    sortOrder: 0,
    parentId: null,
    heroImageKey: null,
    createdAt: new Date("2026-01-05T10:00:00.000Z"),
    updatedAt: new Date("2026-02-01T10:00:00.000Z"),
    usage: { lots: 0, sales: 0, submissions: 0, interests: 0, total: 0 },
    ...patch,
  };
}

const summary: AdminCategoriesListSummary = {
  totalCount: 14,
  activeCount: 12,
  archivedCount: 2,
  usageTotals: { lots: 1200, sales: 30, submissions: 70 },
  mostUsedCategory: {
    id: "c1",
    name: "Ceramics",
    slug: "ceramics",
    usage: { lots: 900, sales: 10, submissions: 5, total: 915 },
  },
};

describe("categories staff list view model", () => {
  it("puts sub-categories under their parent and names them as such", () => {
    const rows = toCategoriesStaffRows([
      category({ id: "child", name: "Vases", slug: "vases", parentId: "root" }),
      category({ id: "root" }),
    ]);
    expect(rows.map((row) => row.id)).toEqual(["root", "child"]);
    expect(rows[0]?.context).toBe("/ceramics");
    expect(rows[1]?.context).toBe("Sub-category · /vases");
  });

  it("reads status in words and allows deleting only what is unused", () => {
    const [archived, used, unused] = toCategoriesStaffRows([
      category({ id: "a", archived: true, name: "A", sortOrder: 1 }),
      category({
        id: "b",
        name: "B",
        sortOrder: 2,
        usage: { lots: 2, sales: 0, submissions: 0, interests: 0, total: 2 },
      }),
      category({ id: "c", name: "C", sortOrder: 3 }),
    ]);
    expect(archived?.status.label).toBe("Archived");
    expect(used?.status.label).toBe("Active");
    expect(used?.canDelete).toBe(false);
    expect(unused?.canDelete).toBe(true);
    expect(unused?.updatedAt).toBe("2026-02-01T10:00:00.000Z");
  });

  it("counts assignments in words", () => {
    expect(assignmentsLabel(0)).toBe("Not used yet");
    expect(assignmentsLabel(1)).toBe("1 assignment");
    expect(assignmentsLabel(1204)).toBe("1,204 assignments");
  });

  it("offers the archive lens as a tab with counts only when the summary is known", () => {
    const [active, all] = categoriesViews({ q: "vase" }, summary);
    expect(active?.count).toBe(12);
    expect(all?.count).toBe(14);
    expect(all?.href).toBe("/admin/categories?q=vase&includeArchived=true");
    expect(active?.href).toBe("/admin/categories?q=vase");
    expect(categoriesViews({}, null).some((view) => view.count !== undefined)).toBe(false);
    expect(categoriesActiveView(true)).toBe("archived");
    expect(categoriesActiveView(false)).toBe("active");
  });

  it("formats the headline numbers in full", () => {
    const metrics = categoriesMetrics(summary);
    expect(metrics.find((metric) => metric.id === "assignments")?.value).toBe("1,300");
    expect(metrics.find((metric) => metric.id === "most-used")?.value).toBe("Ceramics");
    expect(categoriesMetrics({ ...summary, mostUsedCategory: null })).toHaveLength(3);
  });

  it("builds list and panel URLs that return to the first page", () => {
    expect(categoriesListHref({ offset: "50", category: "c1" }, { q: "vase" })).toBe(
      "/admin/categories?q=vase",
    );
    expect(categoryPanelHref({ q: "vase" }, "c1")).toBe("/admin/categories?q=vase&category=c1");
    expect(categoryPanelHref({ q: "vase", category: "c1" }, null)).toBe("/admin/categories?q=vase");
  });

  it("summarises the range with the right plural", () => {
    expect(categoriesRangeSummary(0, 50, 312)).toBe("1–50 of 312 categories");
    expect(categoriesRangeSummary(0, 1, 1)).toBe("1–1 of 1 category");
  });
});
