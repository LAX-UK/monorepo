import type { EditorialLinkItem } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  RAIL_MAX_ITEMS,
  matchRailSlugs,
  missingRailRow,
  pendingRailRow,
  railRowFromItem,
  railRowsFor,
  railSlugs,
} from "./editorial-rails.vm";

const item = (slug: string, title: string, published = true): EditorialLinkItem => ({
  id: `id-${slug}`,
  title,
  slug,
  thumbnailUrl: null,
  published,
});

describe("rail rows", () => {
  it("are identified by slug, which is what the block stores, and show the title", () => {
    expect(railRowFromItem(item("paper-rooms", "Paper Rooms"))).toEqual({
      id: "paper-rooms",
      slug: "paper-rooms",
      title: "Paper Rooms",
      subtitle: "/paper-rooms",
      notPublic: false,
    });
  });

  it("flag a record the public site cannot show", () => {
    expect(railRowFromItem(item("draft-work", "Draft work", false)).notPublic).toBe(true);
  });

  it("keep the order of the stored slugs and write the same slugs back", () => {
    const known = new Map([["b", railRowFromItem(item("b", "Bee"))]]);
    const rows = railRowsFor(["a", "b"], known);
    expect(rows.map((row) => row.title)).toEqual(["a", "Bee"]);
    expect(rows[0]).toEqual(pendingRailRow("a"));
    expect(railSlugs(rows)).toEqual(["a", "b"]);
  });

  it("allow as many records as the content contract does", () => {
    expect(RAIL_MAX_ITEMS).toBe(24);
  });
});

describe("matchRailSlugs", () => {
  it("names a slug only from an exact address match, since a search also matches titles", () => {
    const results = new Map([
      [
        "paper",
        [
          item("paper-rooms", "Paper Rooms"),
          item("paper", "Paper"),
          item("newspaper", "Newspaper"),
        ],
      ],
    ]);
    const rows = matchRailSlugs(["paper"], results);
    expect(rows.get("paper")?.title).toBe("Paper");
  });

  it("reports a slug no record answers to, so it can be removed", () => {
    const rows = matchRailSlugs(["gone"], new Map([["gone", [item("other", "Other")]]]));
    expect(rows.get("gone")).toEqual(missingRailRow("gone"));
    expect(rows.get("gone")?.subtitle).toContain("No record has this address");
  });

  it("reports a slug that was not searched at all", () => {
    expect(matchRailSlugs(["x"], new Map()).get("x")).toEqual(missingRailRow("x"));
  });
});
