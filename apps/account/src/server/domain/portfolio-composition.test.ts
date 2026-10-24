import { describe, expect, it } from "vitest";
import { buildSourceNotices, composeSources } from "./portfolio-composition";
import type { SourceResults } from "./portfolio-sources";

const ok = (rows: string[], partial = false) => ({ status: "ok" as const, rows, partial });
const down = { status: "unavailable" as const };

describe("composeSources", () => {
  it("joins the rows of every source in a fixed order and is complete", () => {
    const results: SourceResults<string> = { bid: ok(["b1"]), shop: ok(["s1", "s2"]) };
    expect(composeSources(results)).toEqual({
      rows: ["b1", "s1", "s2"],
      unavailable: [],
      partial: [],
      complete: true,
    });
  });

  it("keeps the other product's rows when one is down, and is not complete", () => {
    const composed = composeSources<string>({ bid: down, shop: ok(["s1"]) });
    expect(composed.rows).toEqual(["s1"]);
    expect(composed.unavailable).toEqual(["bid"]);
    expect(composed.complete).toBe(false);
  });

  it("flags a product that answered partially as incomplete", () => {
    const composed = composeSources<string>({ bid: ok(["b1"], true), shop: ok([]) });
    expect(composed.rows).toEqual(["b1"]);
    expect(composed.partial).toEqual(["bid"]);
    expect(composed.complete).toBe(false);
  });

  it("is incomplete with no rows when every product is down", () => {
    const composed = composeSources<string>({ bid: down, shop: down });
    expect(composed.rows).toEqual([]);
    expect(composed.unavailable).toEqual(["bid", "shop"]);
    expect(composed.complete).toBe(false);
  });
});

describe("buildSourceNotices", () => {
  it("names the product that is unavailable and says totals leave it out", () => {
    const [notice] = buildSourceNotices({ unavailable: ["bid"], partial: [] }, "items");
    expect(notice?.text).toBe(
      "LAX Bid items are unavailable right now. Counts and totals on this page leave them out.",
    );
  });

  it("merges two unavailable products into one notice that names both", () => {
    const notices = buildSourceNotices({ unavailable: ["bid", "shop"], partial: [] }, "items");
    expect(notices).toHaveLength(1);
    expect(notices[0]?.id.startsWith("unavailable")).toBe(true);
    expect(notices[0]?.text).toBe(
      "We can't reach LAX Bid or LAX Shop and lax.art right now. Their items are unavailable, and counts and totals on this page leave them out.",
    );
  });

  it("describes money separately from items", () => {
    const [notice] = buildSourceNotices({ unavailable: ["shop"], partial: [] }, "money");
    expect(notice?.text).toContain("LAX Shop and lax.art money details are unavailable");
  });

  it("carries a partial answer as a note", () => {
    const [notice] = buildSourceNotices({ unavailable: [], partial: ["bid"] }, "items");
    expect(notice?.text).toBe(
      "Some LAX Bid items are not shown yet, so this may not be everything.",
    );
  });

  it("is empty when everything answered in full", () => {
    expect(buildSourceNotices({ unavailable: [], partial: [] }, "items")).toEqual([]);
  });
});
