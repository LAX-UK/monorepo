import { artworkSummary } from "@/test/artwork-summary.fixture";
import { describe, expect, it } from "vitest";
import { editionGroupSlug, groupEditionVersions } from "./edition-work-group";

const SOLD = { availability: { totalEditions: 30, state: "sold_out" as const } };
const work = (slug: string, price: number | null, extra = {}) =>
  artworkSummary({ slug, workSlug: "harbour", printPricePence: price, ...extra });

describe("groupEditionVersions", () => {
  it("folds versions of one work into one group, in first-seen order", () => {
    const groups = groupEditionVersions([
      work("harbour", 15000),
      artworkSummary({ slug: "other", workSlug: "other", artistSlug: "x" }),
      work("harbour-ap", 9500),
    ]);
    expect(groups.map((g) => g.versions.map((v) => v.slug))).toEqual([
      ["harbour", "harbour-ap"],
      ["other"],
    ]);
  });

  it("leads with the cheapest version and prices from it", () => {
    const [group] = groupEditionVersions([work("harbour", 15000), work("harbour-ap", 9500)]);
    expect(group?.lead.slug).toBe("harbour-ap");
    expect(group?.fromPricePence).toBe(9500);
    expect(group?.versions).toHaveLength(2);
  });

  it("ignores sold-out versions when choosing the lead and price", () => {
    const [group] = groupEditionVersions([work("harbour", 15000), work("harbour-ap", 9500, SOLD)]);
    expect(group?.lead.slug).toBe("harbour");
    expect(group?.fromPricePence).toBe(15000);
    expect(group?.soldOut).toBe(false);
  });

  it("is sold out only when every version is sold out", () => {
    const [all] = groupEditionVersions([work("a", 100, SOLD), work("b", 50, SOLD)]);
    expect(all?.soldOut).toBe(true);
    expect(all?.lead.slug).toBe("b");
    expect(all?.fromPricePence).toBeNull();
  });

  it("does not skip an unpriced version when it is the only buyable one", () => {
    const [group] = groupEditionVersions([work("a", null), work("b", 50, SOLD)]);
    expect(group?.lead.slug).toBe("a");
    expect(group?.soldOut).toBe(false);
    expect(group?.fromPricePence).toBeNull();
  });

  it("keeps editions apart when the catalogue sends no work slug, or artists differ", () => {
    expect(
      groupEditionVersions([artworkSummary({ slug: "a" }), artworkSummary({ slug: "b" })]),
    ).toHaveLength(2);
    expect(
      groupEditionVersions([work("a", 1), work("b", 2, { artistSlug: "someone-else" })]),
    ).toHaveLength(2);
  });
});

describe("editionGroupSlug", () => {
  it("leads to the work's own page when it is among the versions", () => {
    const [group] = groupEditionVersions([work("harbour", 15000), work("harbour-ap", 9500)]);
    expect(group && editionGroupSlug(group)).toBe("harbour");
  });

  it("leads to the lead version when the main run is not listed", () => {
    const [group] = groupEditionVersions([work("harbour-ap", 9500), work("harbour-hc", 12000)]);
    expect(group && editionGroupSlug(group)).toBe("harbour-ap");
  });

  it("leads to the edition itself when it stands alone", () => {
    const [group] = groupEditionVersions([artworkSummary({ slug: "solo" })]);
    expect(group && editionGroupSlug(group)).toBe("solo");
  });
});
