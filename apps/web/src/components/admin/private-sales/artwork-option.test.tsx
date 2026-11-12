import type { DealArtworkOption } from "@auction/validators";
import { describe, expect, it } from "vitest";
import { draftWarning, toArtworkOption } from "./artwork-option";

const base = {
  id: "5b1c1b9e-3a2f-4f6e-9c1d-2f7a8e9d0c11",
  title: "Morning Tide",
  artist: "Hannah Cole",
  medium: null,
  size: null,
  stockCode: "LAX-ORI-HC-24-0043",
  catalogueStatus: "Available",
  thumbnailUrl: null,
  whereItIs: {
    key: "draft_bid_lot",
    chip: { label: "Draft lot in LAX Bid", tone: "info", marker: "hollow" },
  },
  available: true,
  suggested: true,
  draftLot: { saleName: "Winter Modern" },
} as DealArtworkOption;

describe("draftWarning", () => {
  it("names the sale of a linked draft lot, and says the draft cannot be published", () => {
    expect(draftWarning(base)).toBe(
      "A draft lot in Winter Modern is linked. It can't be published while a deal holds the artwork.",
    );
  });

  it("still says it without a sale name, and for a lax.art draft", () => {
    expect(draftWarning({ ...base, draftLot: null })).toBe(
      "A draft lot is linked. It can't be published while a deal holds the artwork.",
    );
    expect(
      draftWarning({
        ...base,
        whereItIs: { key: "draft_lax_art", chip: base.whereItIs.chip },
      }),
    ).toBe("A lax.art draft is linked. It can't be published while a deal holds the artwork.");
  });

  it("has nothing to say for an artwork with no draft", () => {
    expect(
      draftWarning({ ...base, whereItIs: { key: "not_offered", chip: base.whereItIs.chip } }),
    ).toBeNull();
  });
});

describe("toArtworkOption", () => {
  it("puts the enquiry's artist and title in the suggestions heading", () => {
    const option = toArtworkOption(base, {
      suggestions: true,
      suggestion: { artist: "Hannah Cole", title: "Morning Tide" },
    });
    expect(option.group).toBe("Suggested from the enquiry · Hannah Cole, Morning Tide");
  });

  it("keeps the plain heading when the enquiry named nothing, and groups by availability when typing", () => {
    expect(toArtworkOption(base, { suggestions: true }).group).toBe("Suggested from the enquiry");
    expect(toArtworkOption(base, { suggestions: false }).group).toBe("Can be held");
    expect(toArtworkOption({ ...base, available: false }, { suggestions: false }).group).toBe(
      "Can't be held now",
    );
  });

  it("notes the draft that cannot be published on a row that can be held", () => {
    expect(toArtworkOption(base, { suggestions: false }).note).toBe(
      "A draft lot in Winter Modern is linked. It can't be published while a deal holds the artwork.",
    );
  });

  it("gives a row that cannot be held the lock's reason and no note", () => {
    const option = toArtworkOption(
      {
        ...base,
        available: false,
        lock: { reason: "in_bid_sale", message: "In a sale.", link: null },
      },
      { suggestions: false },
    );
    expect(option.disabledReason).toBe("In a sale.");
    expect(option.note).toBeUndefined();
  });
});
