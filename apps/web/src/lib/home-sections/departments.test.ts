import { hangLot } from "@/lib/hang/hang-fixtures";
import { buildDepartments } from "@/lib/home-sections/departments";
import { DEPARTMENTS } from "@auction/domain";
import type { Category } from "@auction/types";
import { describe, expect, it } from "vitest";

const category = (slug: string, over: Partial<Category> = {}): Category => ({
  id: `id-${slug}`,
  name: slug.toUpperCase(),
  slug,
  description: null,
  archived: false,
  sortOrder: 0,
  parentId: null,
  heroImageKey: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

const lotIn = (slug: string, over: Parameters<typeof hangLot>[0] = {}) =>
  hangLot({
    id: `lot-${slug}-${over.id ?? "a"}`,
    categoryId: `id-${slug}`,
    categoryIds: [`id-${slug}`],
    images: [`/${slug}.jpg`],
    ...over,
  });

const withPictures = DEPARTMENTS.map((d) =>
  category(d.slug, { heroImageKey: `staff/${d.slug}.jpg` }),
);

describe("buildDepartments", () => {
  it("shows all twelve departments from the one list, in its order", () => {
    const shown = buildDepartments(withPictures, []);
    expect(shown?.map((d) => d.name)).toEqual(DEPARTMENTS.map((d) => d.label));
  });

  it("uses the department list's name, not the category's", () => {
    const shown = buildDepartments(withPictures, []);
    expect(shown?.[6]?.name).toBe("Watches & clocks");
  });

  it("leaves out a department with no picture at all", () => {
    const categories = withPictures.map((c) =>
      c.slug === "motor-cars" ? { ...c, heroImageKey: null } : c,
    );
    const names = buildDepartments(categories, [])?.map((d) => d.name);
    expect(names).not.toContain("Motor cars");
    expect(names).toHaveLength(11);
  });

  it("leaves out a department with no category, and categories outside the twelve", () => {
    const categories = [
      ...withPictures.filter((c) => c.slug !== "sculpture"),
      category("antiques", { heroImageKey: "staff/antiques.jpg" }),
    ];
    const names = buildDepartments(categories, [])?.map((d) => d.name);
    expect(names).not.toContain("Sculpture");
    expect(names).toHaveLength(11);
  });

  it("uses the staff picture before any lot's", () => {
    const shown = buildDepartments(withPictures, [lotIn("paintings")]);
    expect(shown?.[0]).toMatchObject({ imageUrl: "staff/paintings.jpg", imageSource: "staff" });
  });

  it("falls back to the latest sold lot, then to the latest lot", () => {
    const categories = [category("paintings"), category("sculpture"), category("drawings")];
    const soldEarlier = lotIn("paintings", {
      id: "sold-1",
      status: "ended",
      winnerId: "u1",
      images: ["/sold-early.jpg"],
      endTime: new Date("2026-09-01T10:00:00Z"),
    });
    const soldLater = lotIn("paintings", {
      id: "sold-2",
      status: "ended",
      winnerId: "u1",
      images: ["/sold-late.jpg"],
      endTime: new Date("2026-10-01T10:00:00Z"),
    });
    const liveNewest = lotIn("paintings", {
      id: "live",
      images: ["/live.jpg"],
      endTime: new Date("2026-12-01T10:00:00Z"),
    });
    const onlyLive = lotIn("sculpture", { images: ["/sculpture-live.jpg"] });
    const shown = buildDepartments(categories, [
      soldEarlier,
      soldLater,
      liveNewest,
      onlyLive,
      lotIn("drawings"),
    ]);
    const url = (name: string) => shown?.find((d) => d.name === name)?.imageUrl;
    expect(url("Paintings")).toBe("/sold-late.jpg");
    expect(url("Sculpture")).toBe("/sculpture-live.jpg");
    expect(shown?.find((d) => d.name === "Sculpture")?.imageSource).toBe("lot");
  });

  it("puts departments with live or upcoming lots first", () => {
    const sold = lotIn("paintings", { id: "s", status: "ended", winnerId: "u1" });
    const live = lotIn("motor-cars", { status: "active" });
    const upcoming = lotIn("books-manuscripts", { status: "scheduled" });
    const shown = buildDepartments(withPictures, [sold, live, upcoming]);
    expect(shown?.slice(0, 2).map((d) => d.name)).toEqual(["Motor cars", "Books & manuscripts"]);
    expect(shown?.[2]?.name).toBe("Paintings");
  });

  it("links each tile to its category", () => {
    expect(buildDepartments(withPictures, [])?.[0]?.href).toBe("/search?categoryId=id-paintings");
  });

  it("is hidden below three departments", () => {
    expect(buildDepartments(withPictures.slice(0, 2), [])).toBeNull();
  });
});
