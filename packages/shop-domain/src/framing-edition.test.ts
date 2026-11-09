import { describe, expect, it } from "vitest";
import {
  type EditionFramingInput,
  type FramingOptionFacts,
  buyerFramingChoice,
  editionFramingIssues,
  editionOptionPricePence,
  framingBandForSheetText,
  framingLeadWindow,
  isBuyerOffered,
  parseSheetSizeCm,
} from "./framing-edition.js";

const live: FramingOptionFacts = { status: "active", placeholderBands: [] };
const paused: FramingOptionFacts = { status: "paused", placeholderBands: [] };
const waiting: FramingOptionFacts = { status: "draft", placeholderBands: ["up_to_60x80"] };

const options = new Map<string, FramingOptionFacts>([
  ["oak", live],
  ["black", live],
  ["walnut", paused],
  ["white", waiting],
]);

const sell = (overrides: Partial<EditionFramingInput> = {}): EditionFramingInput => ({
  mode: "unframed_or_framed",
  framedByArtist: "",
  offers: [{ optionId: "oak", overridePence: null }],
  ...overrides,
});

const context = (savedOptionIds: string[] = []) => ({
  band: "up_to_60x80" as const,
  options,
  savedOptionIds: new Set(savedOptionIds),
});

describe("parseSheetSizeCm", () => {
  it.each([
    ["50 × 70 cm", { widthCm: 50, heightCm: 70 }],
    ["50x70cm", { widthCm: 50, heightCm: 70 }],
    ["50 X 70", { widthCm: 50, heightCm: 70 }],
    ["50 by 70 cm", { widthCm: 50, heightCm: 70 }],
    ["29,7 × 42 cm", { widthCm: 29.7, heightCm: 42 }],
  ])("reads %s", (text, expected) => {
    expect(parseSheetSizeCm(text)).toEqual(expected);
  });

  it.each(["", "A2", "500 × 700 mm", "50 cm", "tall", "0 × 70 cm"])("cannot read %s", (text) => {
    expect(parseSheetSizeCm(text)).toBeNull();
  });

  it("cannot read a missing size", () => {
    expect(parseSheetSizeCm(null)).toBeNull();
    expect(parseSheetSizeCm(undefined)).toBeNull();
  });

  it("finds the band from the text, or none for a size that is unknown or too large", () => {
    expect(framingBandForSheetText("50 × 70 cm")).toBe("up_to_60x80");
    expect(framingBandForSheetText("70 × 50 cm")).toBe("up_to_60x80");
    expect(framingBandForSheetText("90 × 120 cm")).toBeNull();
    expect(framingBandForSheetText("A2")).toBeNull();
  });
});

describe("what buyers see", () => {
  it("shows only offered options whose every band has the framer's price", () => {
    expect(isBuyerOffered(live)).toBe(true);
    expect(isBuyerOffered(paused)).toBe(false);
    expect(isBuyerOffered(waiting)).toBe(false);
    expect(isBuyerOffered({ status: "active", placeholderBands: ["up_to_40x50"] })).toBe(false);
  });

  it("charges the edition's own price when it has one, else the catalogue's", () => {
    const catalogue = { up_to_40x50: 12000, up_to_60x80: 19500, up_to_80x100: 26000 };
    expect(editionOptionPricePence({ catalogue, band: "up_to_60x80", overridePence: null })).toBe(
      19500,
    );
    expect(editionOptionPricePence({ catalogue, band: "up_to_60x80", overridePence: 21000 })).toBe(
      21000,
    );
  });

  it("adds both ends of an option's lead time, and nothing when unframed", () => {
    expect(framingLeadWindow({ leadTimeMinDays: 10, leadTimeMaxDays: 15 })).toEqual({
      minDays: 10,
      maxDays: 15,
    });
    expect(framingLeadWindow(null)).toEqual({ minDays: 0, maxDays: 0 });
  });

  it("shows no framing group when no option is visible, so the page is as before", () => {
    expect(
      buyerFramingChoice({ mode: "unframed_or_framed", framedByArtist: "", visibleOptionIds: [] }),
    ).toEqual({ kind: "none" });
  });

  it("lets the buyer choose, unframed by default", () => {
    expect(
      buyerFramingChoice({
        mode: "unframed_or_framed",
        framedByArtist: "",
        visibleOptionIds: ["oak"],
      }),
    ).toEqual({ kind: "choose", required: false, optionIds: ["oak"] });
  });

  it("requires a choice when the edition is sold framed only", () => {
    expect(
      buyerFramingChoice({ mode: "framed_only", framedByArtist: "", visibleOptionIds: ["oak"] }),
    ).toEqual({ kind: "choose", required: true, optionIds: ["oak"] });
  });

  it("cannot be bought framed-only when no option is visible any more", () => {
    expect(
      buyerFramingChoice({ mode: "framed_only", framedByArtist: "", visibleOptionIds: [] }),
    ).toEqual({ kind: "unavailable" });
  });

  it("describes a print that comes framed by the artist, with no choice", () => {
    expect(
      buyerFramingChoice({
        mode: "framed_by_artist",
        framedByArtist: " Oak frame by the artist ",
        visibleOptionIds: ["oak"],
      }),
    ).toEqual({ kind: "framed_by_artist", description: "Oak frame by the artist" });
  });
});

describe("editionFramingIssues", () => {
  it("accepts an offer of an option buyers can see", () => {
    expect(editionFramingIssues(sell(), context())).toEqual([]);
  });

  it("accepts an edition with no framing at all", () => {
    expect(editionFramingIssues(sell({ offers: [] }), context())).toEqual([]);
  });

  it("refuses a new offer of an option that is paused or waiting for prices", () => {
    const issues = editionFramingIssues(
      sell({
        offers: [
          { optionId: "oak", overridePence: null },
          { optionId: "walnut", overridePence: null },
          { optionId: "white", overridePence: null },
        ],
      }),
      context(),
    );
    expect(issues).toEqual([
      { field: "option:walnut", reason: "option_not_offerable" },
      { field: "option:white", reason: "option_not_offerable" },
    ]);
  });

  it("lets an offer already saved stay while its option is paused", () => {
    const issues = editionFramingIssues(
      sell({
        offers: [
          { optionId: "oak", overridePence: null },
          { optionId: "walnut", overridePence: null },
        ],
      }),
      context(["walnut"]),
    );
    expect(issues).toEqual([]);
  });

  it("needs a size band to offer anything: the sheet size must be known and fit", () => {
    expect(editionFramingIssues(sell(), { ...context(), band: null })).toEqual([
      { field: "offers", reason: "no_size_band" },
    ]);
  });

  it("needs at least one visible option when sold framed only", () => {
    expect(editionFramingIssues(sell({ mode: "framed_only", offers: [] }), context())).toEqual([
      { field: "offers", reason: "framed_only_needs_option" },
    ]);
    expect(
      editionFramingIssues(
        sell({ mode: "framed_only", offers: [{ optionId: "walnut", overridePence: null }] }),
        context(["walnut"]),
      ),
    ).toEqual([{ field: "offers", reason: "framed_only_needs_option" }]);
  });

  it("describes the artist's frame, with no offers alongside", () => {
    expect(editionFramingIssues(sell({ mode: "framed_by_artist", offers: [] }), context())).toEqual(
      [{ field: "framedByArtist", reason: "description_required" }],
    );
    expect(
      editionFramingIssues(
        sell({ mode: "framed_by_artist", framedByArtist: "Oak", offers: [] }),
        context(),
      ),
    ).toEqual([]);
    expect(
      editionFramingIssues(sell({ mode: "framed_by_artist", framedByArtist: "Oak" }), context()),
    ).toEqual([{ field: "offers", reason: "offers_not_allowed" }]);
    expect(
      editionFramingIssues(
        sell({ mode: "framed_by_artist", framedByArtist: "x".repeat(501), offers: [] }),
        context(),
      ),
    ).toEqual([{ field: "framedByArtist", reason: "description_too_long" }]);
  });

  it("checks the edition's own price", () => {
    for (const overridePence of [0, -5, 12.5, 1_000_001]) {
      expect(
        editionFramingIssues(sell({ offers: [{ optionId: "oak", overridePence }] }), context()),
      ).toEqual([{ field: "option:oak", reason: "override_invalid" }]);
    }
    expect(
      editionFramingIssues(
        sell({ offers: [{ optionId: "oak", overridePence: 21000 }] }),
        context(),
      ),
    ).toEqual([]);
  });

  it("refuses an option listed twice", () => {
    expect(
      editionFramingIssues(
        sell({
          offers: [
            { optionId: "oak", overridePence: null },
            { optionId: "oak", overridePence: null },
          ],
        }),
        context(),
      ),
    ).toEqual([{ field: "option:oak", reason: "option_listed_twice" }]);
  });
});
