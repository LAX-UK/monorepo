import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";
import { artistWorksTabItems, parseArtistWorksTab, splitArtistWorks } from "./artist-works";

const lot = (id: string, status: string, winnerId: string | null = null) =>
  ({ id, status, winnerId }) as unknown as Lot;

describe("splitArtistWorks", () => {
  it("puts active and scheduled lots on sale and sold ended lots in results", () => {
    const works = splitArtistWorks([
      lot("a", "active"),
      lot("s", "scheduled"),
      lot("sold", "ended", "user-1"),
      lot("unsold", "ended"),
      lot("draft", "draft"),
    ]);
    expect(works.onSale.map((l) => l.id)).toEqual(["a", "s"]);
    expect(works.results.map((l) => l.id)).toEqual(["sold"]);
  });
});

describe("parseArtistWorksTab", () => {
  it("defaults to on sale", () => {
    expect(parseArtistWorksTab(undefined)).toBe("on-sale");
    expect(parseArtistWorksTab("nonsense")).toBe("on-sale");
  });
  it("reads results, including from a repeated parameter", () => {
    expect(parseArtistWorksTab("results")).toBe("results");
    expect(parseArtistWorksTab(["results", "x"])).toBe("results");
  });
});

describe("artistWorksTabItems", () => {
  it("shows a count only above zero", () => {
    const items = artistWorksTabItems({
      profilePath: "/artist/x/1",
      works: { onSale: [], results: [lot("a", "ended", "u"), lot("b", "ended", "u")] },
    });
    expect(items[0]).toEqual({ id: "on-sale", label: "On sale", href: "/artist/x/1#works" });
    expect(items[1]).toMatchObject({
      id: "results",
      label: "Past results",
      href: "/artist/x/1?tab=results#works",
      count: 2,
    });
  });
});
