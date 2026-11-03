import { hangLot } from "@/lib/hang/hang-fixtures";
import { buildDepartments } from "@/lib/home-sections/departments";
import type { Category } from "@auction/types";
import { describe, expect, it } from "vitest";

const category = (id: string, over: Partial<Category> = {}): Category => ({
  id,
  name: id.toUpperCase(),
  slug: id,
  description: null,
  archived: false,
  sortOrder: 0,
  parentId: null,
  heroImageKey: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

describe("buildDepartments", () => {
  it("shows top-level departments, those with a picture first", () => {
    const lots = [hangLot({ categoryId: "c", categoryIds: ["c"], images: ["/c.jpg"] })];
    const shown = buildDepartments(
      [category("a"), category("b"), category("c"), category("sub", { parentId: "a" })],
      lots,
    );
    expect(shown?.map((d) => [d.id, d.imageUrl])).toEqual([
      ["c", "/c.jpg"],
      ["a", null],
      ["b", null],
    ]);
    expect(shown?.[0]?.href).toBe("/search?categoryId=c");
  });

  it("uses a department's own picture before a work's", () => {
    const shown = buildDepartments(
      [category("a", { heroImageKey: "uploads/a.jpg" }), category("b"), category("c")],
      [hangLot({ categoryId: "a", categoryIds: ["a"], images: ["/lot.jpg"] })],
    );
    expect(shown?.[0]?.imageUrl).toBe("uploads/a.jpg");
  });

  it("is hidden below three departments, and skips archived ones", () => {
    expect(buildDepartments([category("a"), category("b")], [])).toBeNull();
    expect(
      buildDepartments([category("a"), category("b"), category("c", { archived: true })], []),
    ).toBeNull();
  });

  it("shows at most six", () => {
    const many = ["a", "b", "c", "d", "e", "f", "g", "h"].map((id) => category(id));
    expect(buildDepartments(many, [])).toHaveLength(6);
  });
});
