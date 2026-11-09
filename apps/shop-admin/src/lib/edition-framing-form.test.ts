import type { AdminEditionFraming, AdminEditionFramingOption } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  editionFramingBody,
  editionFramingFormValues,
  isEditionFramingDirty,
  optionUnavailableReason,
  shoppersWillSee,
  sizeBandSentence,
  validateEditionFramingForm,
} from "./edition-framing-form";

const option = (
  id: string,
  name: string,
  overrides: Partial<AdminEditionFramingOption> = {},
): AdminEditionFramingOption => ({
  optionId: id,
  name,
  frame: "natural_oak",
  mount: "window_conservation",
  glazing: "uv_acrylic",
  hanging: "d_rings_cord",
  leadTimeMinDays: 10,
  leadTimeMaxDays: 15,
  catalogueStatus: "active",
  placeholderBands: [],
  cataloguePricePence: 19500,
  offered: false,
  overridePence: null,
  offerable: true,
  ...overrides,
});

const framing: AdminEditionFraming = {
  artworkId: "00000000-0000-4000-8000-0000000000b1",
  mode: "unframed_or_framed",
  framedByArtist: "",
  sheetSize: "50 × 70 cm",
  band: "up_to_60x80",
  version: "2026-11-01T09:00:00.000Z",
  options: [
    option("black", "Black wood frame"),
    option("oak", "Natural oak frame", { offered: true, overridePence: 21000 }),
    option("walnut", "Walnut frame", { catalogueStatus: "paused", offerable: false }),
    option("white", "White wood frame", {
      catalogueStatus: "draft",
      placeholderBands: ["up_to_60x80"],
      offerable: false,
    }),
  ],
};

describe("the form's values", () => {
  it("start from what is saved", () => {
    const values = editionFramingFormValues(framing);
    expect(values.mode).toBe("unframed_or_framed");
    expect(values.offers.oak).toEqual({ offered: true, overridePence: 21000 });
    expect(values.offers.black).toEqual({ offered: false, overridePence: null });
  });

  it("are not dirty until something changes", () => {
    const baseline = editionFramingFormValues(framing);
    expect(isEditionFramingDirty(baseline, baseline)).toBe(false);
    expect(
      isEditionFramingDirty(
        {
          ...baseline,
          offers: { ...baseline.offers, black: { offered: true, overridePence: null } },
        },
        baseline,
      ),
    ).toBe(true);
    expect(isEditionFramingDirty({ ...baseline, mode: "framed_only" }, baseline)).toBe(true);
  });

  it("ignore an edition price left on an option that is switched off", () => {
    const baseline = editionFramingFormValues(framing);
    const values = {
      ...baseline,
      offers: { ...baseline.offers, black: { offered: false, overridePence: 5000 } },
    };
    expect(isEditionFramingDirty(values, baseline)).toBe(false);
  });
});

describe("the save body", () => {
  it("lists the offered options in catalogue order with the version it was opened from", () => {
    const values = editionFramingFormValues(framing);
    values.offers.black = { offered: true, overridePence: null };
    expect(editionFramingBody(values, framing)).toEqual({
      mode: "unframed_or_framed",
      framedByArtist: "",
      offers: [
        { optionId: "black", overridePence: null },
        { optionId: "oak", overridePence: 21000 },
      ],
      expectedVersion: "2026-11-01T09:00:00.000Z",
    });
  });

  it("sends no options for a print framed by the artist, and trims their description", () => {
    const values = {
      ...editionFramingFormValues(framing),
      mode: "framed_by_artist" as const,
      framedByArtist: "  Oak frame by the artist ",
    };
    expect(editionFramingBody(values, framing)).toMatchObject({
      mode: "framed_by_artist",
      framedByArtist: "Oak frame by the artist",
      offers: [],
    });
  });
});

describe("validateEditionFramingForm", () => {
  it("accepts what is saved", () => {
    expect(validateEditionFramingForm(editionFramingFormValues(framing), framing).ok).toBe(true);
  });

  it("asks for an option when sold framed only", () => {
    const values = editionFramingFormValues(framing);
    values.mode = "framed_only";
    values.offers.oak = { offered: false, overridePence: null };
    expect(validateEditionFramingForm(values, framing)).toEqual({
      ok: false,
      errors: { offers: "Offer at least one option, or sell this edition another way" },
    });
  });

  it("asks for the artist's frame to be described", () => {
    const values = { ...editionFramingFormValues(framing), mode: "framed_by_artist" as const };
    expect(validateEditionFramingForm(values, framing)).toEqual({
      ok: false,
      errors: { framedByArtist: "Describe the artist's frame" },
    });
  });

  it("refuses a new offer of an option that is paused or waiting for prices", () => {
    const values = editionFramingFormValues(framing);
    values.offers.walnut = { offered: true, overridePence: null };
    values.offers.white = { offered: true, overridePence: null };
    const result = validateEditionFramingForm(values, framing);
    expect(result.ok).toBe(false);
    expect(Object.keys(result.ok ? {} : result.errors)).toEqual(["option:walnut", "option:white"]);
  });

  it("checks the edition's own price", () => {
    const values = editionFramingFormValues(framing);
    values.offers.oak = { offered: true, overridePence: 1_000_001 };
    expect(validateEditionFramingForm(values, framing)).toEqual({
      ok: false,
      errors: { "option:oak": "Enter a price from £0.01 to £10,000.00" },
    });
  });

  it("needs a size band to offer anything", () => {
    const result = validateEditionFramingForm(editionFramingFormValues(framing), {
      ...framing,
      band: null,
    });
    expect(result).toEqual({
      ok: false,
      errors: {
        offers: "Add the sheet size, up to 80 × 100 cm, on the Edition card to offer framing",
      },
    });
  });
});

describe("the words on the card", () => {
  it("says why an option cannot be switched on", () => {
    expect(optionUnavailableReason(framing.options[0] as AdminEditionFramingOption)).toBeNull();
    expect(optionUnavailableReason(framing.options[2] as AdminEditionFramingOption)).toBe(
      "Paused in the catalogue",
    );
    expect(optionUnavailableReason(framing.options[3] as AdminEditionFramingOption)).toBe(
      "Waiting for the framer's prices in the catalogue",
    );
  });

  it("names the size band, or says what to add", () => {
    expect(sizeBandSentence(framing)).toBe(
      "Size band: up to 60 × 80 cm, from the 50 × 70 cm sheet",
    );
    expect(sizeBandSentence({ band: null, sheetSize: null })).toMatch(/^No sheet size yet/);
    expect(sizeBandSentence({ band: null, sheetSize: "90 × 120 cm" })).toMatch(/is larger than/);
  });

  it("previews what shoppers will see: unframed first, then each option with its price", () => {
    const values = editionFramingFormValues(framing);
    values.offers.black = { offered: true, overridePence: null };
    expect(shoppersWillSee(framing, values, 18000)).toEqual([
      "Unframed £180.00",
      "Black wood frame +£195.00",
      "Natural oak frame +£210.00 (edition price)",
    ]);
  });

  it("leaves out options that buyers would not be shown, and framing-only has no unframed line", () => {
    const values = editionFramingFormValues(framing);
    values.offers.walnut = { offered: true, overridePence: null };
    values.mode = "framed_only";
    expect(shoppersWillSee(framing, values, 18000)).toEqual([
      "Natural oak frame +£210.00 (edition price)",
    ]);
  });

  it("previews nothing when no option would show, so the page is as it was", () => {
    const values = editionFramingFormValues(framing);
    values.offers.oak = { offered: false, overridePence: null };
    expect(shoppersWillSee(framing, values, 18000)).toEqual([]);
  });

  it("previews the artist's frame", () => {
    const values = {
      ...editionFramingFormValues(framing),
      mode: "framed_by_artist" as const,
      framedByArtist: "Oak frame by the artist",
    };
    expect(shoppersWillSee(framing, values, 18000)).toEqual([
      "Comes framed: Oak frame by the artist",
    ]);
  });
});
