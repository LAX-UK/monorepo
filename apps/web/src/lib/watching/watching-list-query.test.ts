import { describe, expect, it } from "vitest";
import { parseWatchingListQuery, watchingListSearch } from "./watching-list-query";

describe("the Watching address", () => {
  it("is plain /watching by default", () => {
    const q = parseWatchingListQuery({});
    expect(q).toEqual({ view: "lots", q: "", sort: "closing" });
    expect(watchingListSearch(q)).toBe("");
  });

  it("round-trips search and sort on lots", () => {
    const q = parseWatchingListQuery({ q: "harbour light", sort: "added" });
    expect(q).toEqual({ view: "lots", q: "harbour light", sort: "added" });
    expect(
      parseWatchingListQuery(Object.fromEntries(new URLSearchParams(watchingListSearch(q)))),
    ).toEqual(q);
  });

  it("keeps the tab address and the search on other views, and ignores an unknown sort", () => {
    const q = parseWatchingListQuery({ tab: "artists", q: "ada", sort: "bogus" });
    expect(q).toEqual({ view: "artists", q: "ada", sort: "closing" });
    expect(watchingListSearch(q)).toBe("?tab=artists&q=ada");
  });

  it("reads the old section=artists address", () => {
    expect(parseWatchingListQuery({ section: "artists" }).view).toBe("artists");
  });
});
