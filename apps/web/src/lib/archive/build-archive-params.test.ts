import {
  archiveClearFiltersHref,
  archiveSortLabel,
  buildArchiveActiveFilterChips,
  buildArchiveHrefFromQuery,
  buildArchivePageQuery,
  countActiveArchiveFilters,
} from "@/lib/archive/build-archive-params";
import { describe, expect, it } from "vitest";

describe("buildArchivePageQuery", () => {
  it("defaults to hammer sort and page 1", () => {
    const q = buildArchivePageQuery({});
    expect(q.sortMode).toBe("hammer");
    expect(q.page).toBe(1);
    expect(q.endYear).toBeUndefined();
    expect(q.categoryId).toBeUndefined();
    expect(q.listParams.status).toBe("ended");
  });

  it("parses year, category, sort, and page", () => {
    const q = buildArchivePageQuery({
      year: "2024",
      categoryId: "cat-1",
      sort: "artist",
      page: "2",
    });
    expect(q.endYear).toBe(2024);
    expect(q.categoryId).toBe("cat-1");
    expect(q.sortMode).toBe("artist");
    expect(q.page).toBe(2);
    expect(q.listParams.sort).toBe("sellerAsc");
  });
});

describe("countActiveArchiveFilters", () => {
  it("counts year, medium, and non-default sort", () => {
    expect(
      countActiveArchiveFilters({
        endYear: 2024,
        categoryId: "cat-1",
        sortMode: "recent",
      }),
    ).toBe(3);
  });

  it("returns zero for defaults", () => {
    expect(
      countActiveArchiveFilters({
        endYear: undefined,
        categoryId: undefined,
        sortMode: "hammer",
      }),
    ).toBe(0);
  });
});

describe("archiveClearFiltersHref", () => {
  it("returns bare archive path", () => {
    expect(archiveClearFiltersHref()).toBe("/archive");
  });

  it("preserves list view", () => {
    expect(archiveClearFiltersHref("list")).toBe("/archive?view=list");
  });
});

describe("buildArchiveHrefFromQuery", () => {
  const base = { endYear: 2024, categoryId: "cat-1", sortMode: "recent" as const };

  it("clears individual facets", () => {
    expect(buildArchiveHrefFromQuery(base, { endYear: null })).toBe(
      "/archive?categoryId=cat-1&sort=recent",
    );
    expect(buildArchiveHrefFromQuery(base, { categoryId: null })).toBe(
      "/archive?year=2024&sort=recent",
    );
    expect(buildArchiveHrefFromQuery(base, { sortMode: null })).toBe(
      "/archive?year=2024&categoryId=cat-1",
    );
  });

  it("preserves list view when provided", () => {
    expect(buildArchiveHrefFromQuery(base, { endYear: null }, "list")).toBe(
      "/archive?categoryId=cat-1&sort=recent&view=list",
    );
  });
});

describe("buildArchiveActiveFilterChips", () => {
  const categories = [{ id: "cat-1", name: "Painting" }];

  it("builds chips for active facets", () => {
    const chips = buildArchiveActiveFilterChips(
      { endYear: 2024, categoryId: "cat-1", sortMode: "artist" },
      categories,
    );
    expect(chips).toHaveLength(3);
    expect(chips[0]).toMatchObject({ key: "year", label: "2024" });
    expect(chips[1]).toMatchObject({ key: "categoryId", label: "Painting" });
    expect(chips[2]).toMatchObject({
      key: "sort",
      label: archiveSortLabel("artist"),
    });
  });

  it("returns empty when no facets are active", () => {
    expect(
      buildArchiveActiveFilterChips(
        { endYear: undefined, categoryId: undefined, sortMode: "hammer" },
        categories,
      ),
    ).toEqual([]);
  });
});
