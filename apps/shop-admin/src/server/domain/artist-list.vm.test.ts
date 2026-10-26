import { describe, expect, it } from "vitest";
import { artistList, artworkCountLabel } from "./artist-list.vm";

describe("artist list URL state", () => {
  it("defaults to active artists, newest first", () => {
    const state = artistList.parse({});
    expect(state.view).toBe("active");
    expect(artistList.apiQuery(state)).toEqual({ status: "active" });
    expect(artistList.sortState(state)).toEqual({ columnId: "created", direction: "desc" });
  });

  it("asks the API for the view, search and sort in the URL", () => {
    const state = artistList.parse({ view: "archived", q: " ada ", sort: "created_asc" });
    expect(artistList.apiQuery(state)).toEqual({
      status: "archived",
      q: "ada",
      sort: "created_asc",
    });
    expect(artistList.apiQuery(artistList.parse({ view: "all" }))).toEqual({});
  });

  it("drops an unknown view or sort and returns to page one on change", () => {
    const state = artistList.parse({ view: "deleted", sort: "name_asc", q: "ada", cursor: "c" });
    expect(state.view).toBe("active");
    expect(state.sort).toBeUndefined();
    expect(artistList.href(state, { view: "archived" })).toBe("/artists?view=archived&q=ada");
  });

  it("keeps the open artist in the URL", () => {
    const state = artistList.parse({ artist: "a1" });
    expect(artistList.panelHref(state, "a2")).toBe("/artists?artist=a2");
    expect(artistList.panelHref(state, null)).toBe("/artists");
  });

  it("counts each view from the status counts", () => {
    const views = artistList.views(artistList.parse({}), { active: 4, archived: 2 });
    expect(views.map((view) => [view.id, view.count])).toEqual([
      ["active", 4],
      ["archived", 2],
      ["all", 6],
    ]);
  });
});

describe("artworkCountLabel", () => {
  it("names the count in words", () => {
    expect(artworkCountLabel(0)).toBe("No artworks");
    expect(artworkCountLabel(1)).toBe("1 artwork");
    expect(artworkCountLabel(3)).toBe("3 artworks");
  });
});
