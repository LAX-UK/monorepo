import {
  buildCategoryTree,
  filterCategoryTaxonomyRows,
  flattenCategoryTaxonomyRows,
} from "@/lib/admin/categories/category-taxonomy-rows";
import type { AdminCategory } from "@auction/types";
import { describe, expect, it } from "vitest";

const stamp = new Date("2024-01-01T00:00:00.000Z");

function cat(
  overrides: Partial<AdminCategory> & Pick<AdminCategory, "id" | "name" | "slug">,
): AdminCategory {
  return {
    description: null,
    archived: false,
    sortOrder: 0,
    parentId: null,
    heroImageKey: null,
    createdAt: stamp,
    updatedAt: stamp,
    usage: { lots: 0, sales: 0, submissions: 0, interests: 0, total: 0 },
    ...overrides,
  };
}

describe("category-taxonomy-rows", () => {
  it("sorts siblings by sortOrder then name", () => {
    const rows = flattenCategoryTaxonomyRows([
      cat({ id: "b", name: "Beta", slug: "beta", sortOrder: 2 }),
      cat({ id: "a", name: "Alpha", slug: "alpha", sortOrder: 1 }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("preserves hierarchy depth and orphan-on-page roots", () => {
    const rows = flattenCategoryTaxonomyRows([
      cat({ id: "root", name: "Root", slug: "root" }),
      cat({ id: "child", name: "Child", slug: "child", parentId: "root" }),
      cat({ id: "orphan", name: "Orphan", slug: "orphan", parentId: "missing-parent" }),
    ]);

    expect(rows).toHaveLength(3);
    expect(rows.find((r) => r.id === "child")?.depth).toBe(1);
    expect(rows.find((r) => r.id === "orphan")?.depth).toBe(0);
  });

  it("builds nested tree structure", () => {
    const tree = buildCategoryTree([
      cat({ id: "root", name: "Root", slug: "root" }),
      cat({ id: "child", name: "Child", slug: "child", parentId: "root" }),
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.children).toHaveLength(1);
    expect(tree[0]?.children[0]?.id).toBe("child");
  });

  it("filters rows by name or slug", () => {
    const rows = flattenCategoryTaxonomyRows([
      cat({ id: "1", name: "Fine Art", slug: "fine-art" }),
      cat({ id: "2", name: "Sculpture", slug: "sculpture" }),
    ]);
    expect(filterCategoryTaxonomyRows(rows, "fine").map((r) => r.id)).toEqual(["1"]);
    expect(filterCategoryTaxonomyRows(rows, "sculpture").map((r) => r.id)).toEqual(["2"]);
  });
});
