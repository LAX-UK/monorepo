import type { AdminWhereItIs } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { whereItIsLine } from "./where-it-is.vm";

const NOW = new Date("2026-11-05T10:00:00.000Z");

function place(overrides: Partial<AdminWhereItIs> & Pick<AdminWhereItIs, "key">): AdminWhereItIs {
  return {
    chip: { label: "x", tone: "neutral", marker: "hollow" },
    from: null,
    since: null,
    ...overrides,
  };
}

describe("whereItIsLine", () => {
  it("says an unplaced artwork is not offered, and what it can do", () => {
    expect(whereItIsLine(place({ key: "not_offered" }), { now: NOW })).toEqual({
      lead: "Not offered",
      trail: " anywhere",
      note: "It can go on lax.art or into a LAX Bid sale. Only one place at a time.",
    });
  });

  it("dates a draft from when the listing was made", () => {
    const line = whereItIsLine(place({ key: "draft_lax_art" }), {
      draftCreatedAt: "2026-11-04T10:42:00.000Z",
      now: NOW,
    });
    expect(line.lead).toBe("Draft on lax.art");
    expect(line.trail).toBe(" · created Wed 4 Nov, 10:42 GMT");
    expect(line.note).toContain("Buyers can't see it yet");
  });

  it("says since when an artwork has been live on lax.art", () => {
    const line = whereItIsLine(place({ key: "lax_art", since: "2026-11-02T15:20:00.000Z" }), {
      now: NOW,
    });
    expect(line).toMatchObject({
      lead: "Live on lax.art",
      trail: " since Mon 2 Nov, 15:20 GMT",
    });
  });

  it("says where a withdrawn artwork came from and when", () => {
    const line = whereItIsLine(
      place({ key: "withdrawn", from: "LAX Bid", since: "2026-10-30T09:00:00.000Z" }),
      { now: NOW },
    );
    expect(line).toMatchObject({
      lead: "Withdrawn",
      trail: " from LAX Bid · Fri 30 Oct, 09:00 GMT",
    });
  });

  it("says where a sale happened, and that a sale is final", () => {
    const line = whereItIsLine(
      place({ key: "sold", from: "In the gallery, per Zoho", since: "2026-11-04T11:06:00.000Z" }),
      { now: NOW },
    );
    expect(line).toMatchObject({
      lead: "Sold",
      trail: " · In the gallery, per Zoho · Wed 4 Nov, 11:06 GMT",
      note: "Sold is final. Nothing can offer it again.",
    });
  });

  it("copes with a history that does not say when", () => {
    expect(whereItIsLine(place({ key: "sold" }), { now: NOW }).trail).toBe("");
    expect(whereItIsLine(place({ key: "withdrawn" }), { now: NOW }).trail).toBe("");
  });

  it("points a print to LAX Shop whatever the place says", () => {
    expect(whereItIsLine(place({ key: "not_offered" }), { isPrint: true })).toEqual({
      lead: "Prints are sold in runs",
      trail: " on LAX Shop",
      note: "They are not offered on lax.art or at auction.",
    });
  });
});
