import type { AdminZohoLinkOutcome, AdminZohoLinkRow } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { groupRows, outcomeSentence, planBulkLink, summariseOutcomes } from "./zoho-link.vm";
import { activeZohoTab, parseZohoQueueQuery, zohoQueueHref } from "./zoho-register.vm";

const A = "11111111-1111-4111-8111-111111111111";
const R = "22222222-2222-4222-8222-222222222222";

const row = (
  id: string,
  candidate: Partial<AdminZohoLinkRow["candidates"][number]> = {},
): AdminZohoLinkRow => ({
  listing: {
    artworkId: `${id}-a`,
    slug: id,
    title: id,
    artistName: "Ada Rowe",
    artistCode: "AR",
    stockCode: null,
    dimensions: null,
    year: null,
    published: true,
  },
  candidates: [
    {
      record: {
        registerId: `${id}-r`,
        stockCode: "LAX-ORI-AR-TM-26-0001",
        title: id,
        artistName: "Ada Rowe",
        artistCode: "AR",
        dimensions: null,
        year: null,
        zohoStatus: "Available",
        whereItIs: "Not offered",
      },
      differences: [],
      refusal: null,
      ...candidate,
    },
  ],
  rule: "artist_and_title",
  reason: null,
});

describe("the Link lax.art tab in the queue's URL", () => {
  it("is addressed as ?tab=link and is not the default", () => {
    expect(parseZohoQueueQuery({ tab: "link" })).toEqual({ tab: "link" });
    expect(activeZohoTab({ tab: "link" })).toBe("link");
    expect(zohoQueueHref({}, { tab: "link" })).toBe("/from-zoho?tab=link");
  });
});

describe("planBulkLink", () => {
  it("links the Matched rows with no refusal and sets the others aside with their reason", () => {
    const plan = planBulkLink([
      row("one"),
      row("two", {
        differences: [{ field: "year", label: "Year", zohoValue: "2024", laxArtValue: "2023" }],
      }),
      row("three", { refusal: "This artwork is in a LAX Bid sale." }),
    ]);
    expect(plan.links).toEqual([
      { artworkId: "one-a", registerId: "one-r" },
      { artworkId: "two-a", registerId: "two-r" },
    ]);
    expect(plan.withDifferences).toBe(1);
    expect(plan.refused.map((item) => item.row.listing.slug)).toEqual(["three"]);
  });

  it("is empty when nothing is matched", () => {
    expect(planBulkLink([]).links).toEqual([]);
  });
});

describe("bulk outcomes", () => {
  const outcome = (status: AdminZohoLinkOutcome["status"]): AdminZohoLinkOutcome => ({
    artworkId: A,
    registerId: R,
    status,
    message: null,
    nowOnLaxArt: false,
    replaced: [],
  });

  it("counts each kind", () => {
    expect(summariseOutcomes([outcome("linked"), outcome("linked"), outcome("refused")])).toEqual({
      linked: 2,
      alreadyLinked: 0,
      refused: 1,
      notAMatch: 0,
    });
  });

  it("says it in one line, leaving out what did not happen", () => {
    expect(outcomeSentence([outcome("linked")])).toBe("1 artwork linked.");
    expect(
      outcomeSentence([
        outcome("linked"),
        outcome("linked"),
        outcome("already_linked"),
        outcome("refused"),
        outcome("not_a_match"),
      ]),
    ).toBe("2 artworks linked, 1 already linked, 1 refused, 1 no longer a match.");
  });
});

describe("groupRows", () => {
  it("orders the groups Matched, Needs a choice, No match", () => {
    const groups = groupRows({
      checkedAt: "2026-11-05T09:00:00.000Z",
      counts: { unlinked: 2, matched: 1, needsChoice: 1, noMatch: 0 },
      matched: [row("m")],
      needsChoice: [row("c")],
      noMatch: [],
      blockUnlinkedPublish: false,
    });
    expect(groups.map((g) => [g.label, g.rows.length])).toEqual([
      ["Matched", 1],
      ["Needs a choice", 1],
      ["No match", 0],
    ]);
  });
});
