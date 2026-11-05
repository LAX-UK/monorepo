import { DIFFERENT, SAME, candidate, linkedRow, row } from "@/components/from-zoho/link-fixtures";
import type { AdminZohoLinkOutcome } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  LINK_PAGE_SIZE,
  artistOptions,
  narrowLinked,
  narrowRows,
  pageOf,
} from "./zoho-link-list.vm";
import {
  bulkSummary,
  changeRows,
  joinFields,
  linkFootnote,
  outcomeSentence,
  planBulkLink,
  summariseOutcomes,
} from "./zoho-link.vm";
import { activeZohoTab, parseZohoQueueQuery, zohoQueueHref } from "./zoho-register.vm";

const A = "11111111-1111-4111-8111-111111111111";
const R = "22222222-2222-4222-8222-222222222222";

describe("the Link lax.art tab in the queue's URL", () => {
  it("is addressed as ?tab=link and is not the default", () => {
    expect(parseZohoQueueQuery({ tab: "link" })).toEqual({ tab: "link" });
    expect(activeZohoTab({ tab: "link" })).toBe("link");
    expect(zohoQueueHref({}, { tab: "link" })).toBe("/from-zoho?tab=link");
  });

  it("keeps the part, search and filters, and ignores values it does not know", () => {
    expect(
      parseZohoQueueQuery({
        tab: "link",
        view: "choice",
        q: " sun ",
        matched: "stock_code",
        on: "draft",
        sort: "artist",
        artist: "Ada Rowe",
      }),
    ).toEqual({
      tab: "link",
      view: "choice",
      q: "sun",
      matched: "stock_code",
      on: "draft",
      sort: "artist",
      artist: "Ada Rowe",
    });
    expect(parseZohoQueueQuery({ view: "matched", matched: "nope", on: "x" })).toEqual({});
  });
});

describe("narrowing the report", () => {
  const rows = [
    row(1, { rule: "stock_code" }, { title: "Harbour at dusk", artistName: "Ben Ilsley" }),
    row(
      2,
      { rule: "artist_and_title" },
      { title: "Sun disc", artistName: "Dev Patel", published: false },
    ),
    row(3, { rule: "artist_and_title" }, { title: "Blue weave", artistName: "Ada Rowe" }),
  ];
  const titles = (found: typeof rows) => found.map((r) => r.listing.title);

  it("orders by title, or by artist when asked", () => {
    expect(titles(narrowRows(rows, {}))).toEqual(["Blue weave", "Harbour at dusk", "Sun disc"]);
    expect(titles(narrowRows(rows, { sort: "artist" }))).toEqual([
      "Blue weave",
      "Harbour at dusk",
      "Sun disc",
    ]);
  });

  it("finds words in the title, the artist or a stock code", () => {
    expect(titles(narrowRows(rows, { q: "dev patel" }))).toEqual(["Sun disc"]);
    expect(titles(narrowRows(rows, { q: "LAX-ORI-AR-TM-26-0003" }))).toEqual(["Blue weave"]);
  });

  it("filters by artist, rule and live or draft", () => {
    expect(titles(narrowRows(rows, { artist: "Ben Ilsley" }))).toEqual(["Harbour at dusk"]);
    expect(titles(narrowRows(rows, { matched: "stock_code" }))).toEqual(["Harbour at dusk"]);
    expect(titles(narrowRows(rows, { on: "draft" }))).toEqual(["Sun disc"]);
  });

  it("narrows the linked rows the same way", () => {
    const linked = [
      linkedRow(1),
      linkedRow(2, { listing: { ...linkedRow(2).listing, published: false } }),
    ];
    expect(narrowLinked(linked, { on: "draft" })).toHaveLength(1);
  });

  it("lists the artists with how many rows each has", () => {
    expect(artistOptions(rows.map((r) => r.listing))).toEqual([
      { value: "Ada Rowe", label: "Ada Rowe (1)" },
      { value: "Ben Ilsley", label: "Ben Ilsley (1)" },
      { value: "Dev Patel", label: "Dev Patel (1)" },
    ]);
  });

  it("pages in fifty and keeps to the last page", () => {
    const many = Array.from({ length: 120 }, (_, i) => i);
    expect(pageOf(many, {}).items).toHaveLength(LINK_PAGE_SIZE);
    expect(pageOf(many, { page: "3" }).items).toHaveLength(20);
    expect(pageOf(many, { page: "9" }).page).toBe(3);
  });
});

describe("planBulkLink", () => {
  it("links the rows with no refusal and sets the others aside with their reason", () => {
    const plan = planBulkLink([
      row(1),
      row(2, { candidates: [candidate(2, { comparison: DIFFERENT })] }),
      row(3, { candidates: [candidate(3, { refusal: "This artwork is in a LAX Bid sale." })] }),
    ]);
    expect(plan.links).toHaveLength(2);
    expect(plan.withDifferences).toBe(1);
    expect(plan.refused.map((item) => item.row.listing.slug)).toEqual(["work-3"]);
  });

  it("is empty when nothing is matched", () => {
    expect(planBulkLink([]).links).toEqual([]);
  });
});

describe("what a link says about itself", () => {
  it("writes field names as a sentence fragment", () => {
    expect(joinFields(["Title"])).toBe("title");
    expect(joinFields(["Title", "Size"])).toBe("title and size");
    expect(joinFields(["Title", "Size", "Year"])).toBe("title, size and year");
  });

  it("turns a comparison into table rows", () => {
    expect(changeRows(DIFFERENT)[0]).toEqual({
      id: "title",
      label: "Title",
      before: "Tidal Margin 4",
      after: "Tidal margin IV",
      changes: true,
    });
  });

  it("counts the changes and says where the artwork goes", () => {
    expect(linkFootnote({ comparison: DIFFERENT, published: true, whereItIs: "Not offered" })).toBe(
      "2 fields change to Zoho's values. The web address stays the same. It becomes On lax.art in the register.",
    );
    expect(linkFootnote({ comparison: SAME, published: false, whereItIs: "Not offered" })).toBe(
      "lax.art and Zoho already agree. The web address stays the same. It stays a draft. The register shows it as On lax.art when it is published.",
    );
    expect(
      linkFootnote({
        comparison: [DIFFERENT[0] as never],
        published: null,
        whereItIs: "Not offered",
      }),
    ).toBe("1 field changes to Zoho's values. The web address stays the same.");
  });

  it("summarises a bulk link: how many, what changes, live and draft", () => {
    const summary = bulkSummary(
      planBulkLink([
        row(1, { candidates: [candidate(1, { comparison: DIFFERENT })] }),
        row(2, {}, { published: false }),
      ]),
    );
    expect(summary.linked).toBe(2);
    expect(summary.changed.map((item) => item.fields)).toEqual(["title and year"]);
    expect(summary).toMatchObject({ live: 1, drafts: 1 });
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
