import { describe, expect, it } from "vitest";
import {
  type EditorialListApiRow,
  editorialKindOptions,
  editorialList,
  editorialListPage,
  editorialPublicPath,
  matchesQuery,
  parseEditorialList,
  sortEditorialRows,
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
  exhibition({
    id: "2",
    label: "Winter Film",
    slug: "winter-film",
    kind: "film",
    status: "draft",
    updatedAt: "2026-07-03T09:00:00.000Z",
  }),
  exhibition({
    id: "3",
    label: "Open Studios",
    slug: "open-studios",
    kind: "event",
    updatedAt: "2026-07-02T09:00:00.000Z",
  }),
].map((row) => toEditorialListRow("exhibitions", row));

const state = (params: Record<string, string>) => parseEditorialList("exhibitions", params);

describe("parseEditorialList", () => {
  it("reads view, search, kind, sort, page and the open record from the URL", () => {
    expect(
      state({
        view: "published",
        q: " summer ",
        kind: "film",
        sort: "title_asc",
        cursor: "3",
        item: "abc",
      }),
    ).toEqual({
      view: "published",
      q: "summer",
      sort: "title_asc",
      cursor: "3",
      filters: { kind: "film" },
      open: "abc",
    });
  });

  it("falls back to defaults for anything unrecognised", () => {
    expect(state({ view: "archived", kind: "podcast", sort: "price_asc", limit: "5000" })).toEqual({
      view: "all",
      filters: {},
    });
  });

  it("offers a kind filter for exhibitions and stories only", () => {
    expect(editorialKindOptions("exhibitions").map((option) => option.label)).toEqual([
      "Exhibition",
      "Film",
      "Event",
    ]);
    expect(editorialKindOptions("stories")).toHaveLength(5);
    expect(editorialKindOptions("venues")).toEqual([]);
    expect(parseEditorialList("venues", { kind: "film" }).filters).toEqual({});
  });
});

describe("editorialList", () => {
  it("keeps the panel in ?item= and the default sort out of the address", () => {
    const list = editorialList("stories");
    const current = parseEditorialList("stories", {});
    expect(list.panelHref(current, "x")).toBe("/editorial/stories?item=x");
    expect(list.href(current, { sort: "updated_desc" })).toBe("/editorial/stories");
    expect(list.href(current, { sort: "title_asc" })).toBe("/editorial/stories?sort=title_asc");
    expect(list.defaultSortState()).toEqual({ columnId: "updated", direction: "desc" });
  });
});

describe("toEditorialListRow", () => {
  it("labels kinds, dates and cities per entity", () => {
    expect(rows[1]).toMatchObject({ kindLabel: "Film", dates: "1 Jun 2026 – 30 Jun 2026" });
    const venue = toEditorialListRow("venues", {
      id: "v",
      slug: "mayfair",
      label: "Mayfair",
      status: "published",
      updatedAt: "2026-07-01T00:00:00.000Z",
      city: "London",
    });
    expect(venue).toMatchObject({ city: "London", kind: null, kindLabel: null, dates: null });
    const story = toEditorialListRow("stories", {
      id: "s",
      slug: "a",
      label: "A",
      status: "draft",
      updatedAt: "2026-07-01T00:00:00.000Z",
      kind: "podcast",
    });
    expect(story.kindLabel).toBe("Podcast");
  });
});

describe("search", () => {
  it("matches title and slug, ignoring case", () => {
    expect(matchesQuery(rows[0] as never, "SUMMER")).toBe(true);
    expect(matchesQuery(rows[0] as never, "summer-sh")).toBe(true);
    expect(matchesQuery(rows[0] as never, "film")).toBe(false);
    expect(matchesQuery(rows[0] as never, "  ")).toBe(true);
  });
});

describe("sortEditorialRows", () => {
  it("puts the newest edit first, and breaks ties by id the same way the API does", () => {
    const tied = [
      { ...rows[0], id: "a", updatedAt: "2026-07-01T00:00:00.000Z" },
      { ...rows[0], id: "b", updatedAt: "2026-07-01T00:00:00.000Z" },
      { ...rows[0], id: "c", updatedAt: "2026-07-05T00:00:00.000Z" },
    ] as never[];
    const desc = sortEditorialRows(tied, { columnId: "updated", direction: "desc" });
    expect(desc.map((row) => row.id)).toEqual(["c", "b", "a"]);
    const asc = sortEditorialRows(tied, { columnId: "updated", direction: "asc" });
    expect(asc.map((row) => row.id)).toEqual(["a", "b", "c"]);
  });

  it("sorts by title regardless of case", () => {
    const sorted = sortEditorialRows(rows, { columnId: "title", direction: "asc" });
    expect(sorted.map((row) => row.title)).toEqual(["Open Studios", "Summer Show", "Winter Film"]);
  });
});

describe("editorialListPage", () => {
  it("counts each status after search and filters, not after the view", () => {
    const page = editorialListPage("exhibitions", rows, state({ view: "draft" }));
    expect(page.counts).toEqual({ published: 1, draft: 2 });
    expect(page.items.map((row) => row.id)).toEqual(["2", "3"]);
    expect(page.total).toBe(2);
  });

  it("filters by kind and searches on the full set", () => {
    expect(
      editorialListPage("exhibitions", rows, state({ kind: "film" })).items.map((r) => r.id),
    ).toEqual(["2"]);
    expect(
      editorialListPage("exhibitions", rows, state({ q: "studios" })).items.map((r) => r.id),
    ).toEqual(["3"]);
  });

  it("pages over the sorted set and pulls a page past the end back to the last", () => {
    const many = Array.from({ length: 120 }, (_, index) => ({
      ...(rows[0] as object),
      id: String(index).padStart(3, "0"),
      updatedAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    })) as never[];
    const first = editorialListPage("exhibitions", many, state({}));
    expect(first.items).toHaveLength(50);
    expect(first.range).toEqual({ from: 1, to: 50 });
    expect(first.items[0]?.id).toBe("119");
    expect(first.hasPrevious).toBe(false);
    const last = editorialListPage("exhibitions", many, state({ cursor: "9" }));
    expect(last.page).toBe(3);
    expect(last.range).toEqual({ from: 101, to: 120 });
    expect(last.hasNext).toBe(false);
    expect(editorialListPage("exhibitions", many, state({ limit: "100" })).items).toHaveLength(100);
  });

  it("is empty with a zero range when nothing matches", () => {
    const page = editorialListPage("exhibitions", rows, state({ q: "nothing" }));
    expect(page.items).toEqual([]);
    expect(page.range).toEqual({ from: 0, to: 0 });
  });
});

describe("editorialPublicPath", () => {
  it("maps each entity to its lax.art address; pages have none of their own", () => {
    expect(editorialPublicPath("exhibitions", "x")).toBe("/exhibitions/x");
    expect(editorialPublicPath("stories", "x")).toBe("/stories/x");
    expect(editorialPublicPath("venues", "x")).toBe("/visit/x");
    expect(editorialPublicPath("pages", "x")).toBeNull();
  });
});
