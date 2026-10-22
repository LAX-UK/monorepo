import { describe, expect, it } from "vitest";
import {
  type EditorialListApiRow,
  editorialListUrl,
  filterEditorialRows,
  paginateEditorialRows,
  parseEditorialListSearch,
  statusCounts,
  toEditorialListRow,
} from "./editorial-list.vm";

function exhibition(overrides: Partial<EditorialListApiRow>): EditorialListApiRow {
  return {
    id: "1",
    slug: "summer-show",
    label: "Summer Show",
    status: "draft",
    updatedAt: "2026-07-01T13:32:00.000Z",
    kind: "exhibition",
    startsOn: "2026-06-01",
    endsOn: "2026-06-30",
    ...overrides,
  };
}

const rows = [
  exhibition({ id: "1", label: "Summer Show", slug: "summer-show", status: "published" }),
  exhibition({ id: "2", label: "Winter Film", slug: "winter-film", kind: "film", status: "draft" }),
  exhibition({ id: "3", label: "Open Studios", slug: "open-studios", kind: "event" }),
].map((row) => toEditorialListRow("exhibitions", row));

describe("parseEditorialListSearch", () => {
  it("reads q, status and page from the URL", () => {
    expect(parseEditorialListSearch({ q: "  summer ", status: "published", page: "3" })).toEqual({
      q: "summer",
      status: "published",
      page: 3,
    });
  });

  it("falls back to defaults for anything unrecognised", () => {
    expect(parseEditorialListSearch({ status: "archived", page: "-2" })).toEqual({
      q: "",
      status: "all",
      page: 1,
    });
    expect(parseEditorialListSearch({ q: ["a", "b"], page: "x" })).toEqual({
      q: "a",
      status: "all",
      page: 1,
    });
  });
});

describe("toEditorialListRow", () => {
  it("labels exhibition kind and dates in London time and calendar days", () => {
    expect(rows[1]).toMatchObject({
      title: "Winter Film",
      descriptor: "Film",
      dates: "1 Jun 2026 – 30 Jun 2026",
      updated: "1 Jul 2026, 14:32",
    });
  });

  it("uses the story kind label, the venue city and no extras for pages", () => {
    const base = {
      id: "9",
      slug: "s",
      label: "L",
      status: "draft" as const,
      updatedAt: "2026-01-01T00:00:00Z",
    };
    expect(toEditorialListRow("stories", { ...base, kind: "podcast" })).toMatchObject({
      descriptor: "Podcast",
      dates: null,
    });
    expect(toEditorialListRow("venues", { ...base, city: "London" }).descriptor).toBe("London");
    expect(toEditorialListRow("pages", base)).toMatchObject({ descriptor: null, dates: null });
  });
});

describe("filterEditorialRows", () => {
  it("matches title, slug and kind regardless of case", () => {
    expect(filterEditorialRows(rows, { q: "SUMMER", status: "all" }).map((r) => r.id)).toEqual([
      "1",
    ]);
    expect(filterEditorialRows(rows, { q: "winter-film", status: "all" }).map((r) => r.id)).toEqual(
      ["2"],
    );
    expect(filterEditorialRows(rows, { q: "event", status: "all" }).map((r) => r.id)).toEqual([
      "3",
    ]);
  });

  it("filters by status and combines it with the search", () => {
    expect(filterEditorialRows(rows, { q: "", status: "draft" }).map((r) => r.id)).toEqual([
      "2",
      "3",
    ]);
    expect(filterEditorialRows(rows, { q: "film", status: "published" })).toEqual([]);
  });
});

describe("statusCounts", () => {
  it("counts after the search so each chip says what it would show", () => {
    expect(statusCounts(rows, "")).toEqual({ all: 3, published: 1, draft: 2 });
    expect(statusCounts(rows, "film")).toEqual({ all: 1, published: 0, draft: 1 });
  });
});

describe("paginateEditorialRows", () => {
  const many = Array.from({ length: 60 }, (_, index) => ({
    ...(rows[0] as (typeof rows)[number]),
    id: String(index),
  }));

  it("slices a page and says whether there are neighbours", () => {
    const second = paginateEditorialRows(many, 2, 25);
    expect(second).toMatchObject({
      page: 2,
      offset: 25,
      total: 60,
      hasPrevious: true,
      hasNext: true,
    });
    expect(second.rows).toHaveLength(25);
    expect(paginateEditorialRows(many, 3, 25)).toMatchObject({
      hasNext: false,
      rows: expect.any(Array),
    });
  });

  it("pulls a page past the end back to the last page", () => {
    expect(paginateEditorialRows(many, 99, 25)).toMatchObject({ page: 3, offset: 50 });
    expect(paginateEditorialRows([], 4, 25)).toMatchObject({ page: 1, total: 0, hasNext: false });
  });
});

describe("editorialListUrl", () => {
  it("leaves out defaults", () => {
    expect(editorialListUrl("stories", { q: "", status: "all", page: 1 })).toBe(
      "/editorial/stories",
    );
    expect(editorialListUrl("stories", { q: "a b", status: "draft", page: 2 })).toBe(
      "/editorial/stories?q=a+b&status=draft&page=2",
    );
  });
});
