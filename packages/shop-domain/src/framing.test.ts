import { describe, expect, it } from "vitest";
import {
  FRAMING_LAUNCH_OPTIONS,
  type FramingOptionInput,
  framingBandForSheet,
  framingBandLabel,
  framingCodeFromName,
  framingLeadTimeLabel,
  framingOptionIssues,
  framingSaveIssues,
  nextFramingStatus,
  pricesStayPlaceholder,
} from "./framing.js";

const valid: FramingOptionInput = {
  name: "Natural oak frame",
  frame: "natural_oak",
  mount: "window_conservation",
  glazing: "uv_acrylic",
  hanging: "d_rings_cord",
  leadTimeMinDays: 10,
  leadTimeMaxDays: 15,
  pricesPence: { up_to_40x50: 14000, up_to_60x80: 22500, up_to_80x100: 29500 },
};

describe("framingBandForSheet", () => {
  it("picks the smallest band the sheet fits", () => {
    expect(framingBandForSheet(40, 50)).toBe("up_to_40x50");
    expect(framingBandForSheet(50, 70)).toBe("up_to_60x80");
    expect(framingBandForSheet(80, 100)).toBe("up_to_80x100");
  });

  it("measures a sheet either way round", () => {
    expect(framingBandForSheet(50, 40)).toBe("up_to_40x50");
    expect(framingBandForSheet(100, 80)).toBe("up_to_80x100");
  });

  it("quotes anything larger than the biggest band", () => {
    expect(framingBandForSheet(80, 101)).toBeNull();
    expect(framingBandForSheet(90, 90)).toBeNull();
  });

  it("does not guess for a missing size", () => {
    expect(framingBandForSheet(0, 50)).toBeNull();
    expect(framingBandForSheet(Number.NaN, 50)).toBeNull();
  });

  it("names the bands as they appear on screen", () => {
    expect(framingBandLabel("up_to_60x80")).toBe("Up to 60 × 80 cm");
  });
});

describe("framingOptionIssues", () => {
  it("accepts a complete option", () => {
    expect(framingOptionIssues(valid)).toEqual([]);
  });

  it("asks for a name, and not a long one", () => {
    expect(framingOptionIssues({ ...valid, name: "  " })).toEqual([
      { field: "name", reason: "name_required" },
    ]);
    expect(framingOptionIssues({ ...valid, name: "x".repeat(81) })).toEqual([
      { field: "name", reason: "name_too_long" },
    ]);
  });

  it("asks for both ends of the lead time, in order", () => {
    expect(framingOptionIssues({ ...valid, leadTimeMaxDays: null })).toEqual([
      { field: "leadTimeMaxDays", reason: "lead_time_max_invalid" },
    ]);
    expect(framingOptionIssues({ ...valid, leadTimeMinDays: 0 })).toEqual([
      { field: "leadTimeMinDays", reason: "lead_time_min_invalid" },
    ]);
    expect(framingOptionIssues({ ...valid, leadTimeMinDays: 12, leadTimeMaxDays: 10 })).toEqual([
      { field: "leadTimeMaxDays", reason: "lead_time_order" },
    ]);
  });

  it("accepts a single-day range", () => {
    expect(framingOptionIssues({ ...valid, leadTimeMinDays: 10, leadTimeMaxDays: 10 })).toEqual([]);
  });

  it("asks for a price for every band", () => {
    const issues = framingOptionIssues({
      ...valid,
      pricesPence: { up_to_40x50: 14000, up_to_60x80: null, up_to_80x100: null },
    });
    expect(issues).toEqual([
      { field: "price:up_to_60x80", reason: "price_missing" },
      { field: "price:up_to_80x100", reason: "price_missing" },
    ]);
  });

  it("refuses zero, fractional and absurd prices", () => {
    const issues = framingOptionIssues({
      ...valid,
      pricesPence: { up_to_40x50: 0, up_to_60x80: 12.5, up_to_80x100: 1_000_001 },
    });
    expect(issues.map((issue) => issue.reason)).toEqual([
      "price_invalid",
      "price_invalid",
      "price_invalid",
    ]);
  });
});

describe("pricesStayPlaceholder", () => {
  const seeded = {
    pricesPence: { up_to_40x50: 14000, up_to_60x80: 22500, up_to_80x100: 29500 },
    placeholder: true,
  };

  it("keeps them placeholders when nothing changed", () => {
    expect(pricesStayPlaceholder(seeded, seeded.pricesPence)).toBe(true);
  });

  it("makes them real once staff change any one price", () => {
    expect(pricesStayPlaceholder(seeded, { ...seeded.pricesPence, up_to_60x80: 21000 })).toBe(
      false,
    );
  });

  it("never turns real prices back into placeholders", () => {
    expect(pricesStayPlaceholder({ ...seeded, placeholder: false }, seeded.pricesPence)).toBe(
      false,
    );
  });
});

describe("saving an option", () => {
  it("refuses to offer placeholder prices, against the offered switch", () => {
    expect(framingSaveIssues(valid, { offered: true, pricesPlaceholder: true })).toEqual([
      { field: "offered", reason: "placeholder_prices" },
    ]);
  });

  it("lets staff save placeholder prices without offering them", () => {
    expect(framingSaveIssues(valid, { offered: false, pricesPlaceholder: true })).toEqual([]);
  });

  it("offers an option whose prices are real", () => {
    expect(framingSaveIssues(valid, { offered: true, pricesPlaceholder: false })).toEqual([]);
  });

  it("moves status by what staff choose", () => {
    expect(nextFramingStatus("draft", true)).toBe("active");
    expect(nextFramingStatus("paused", true)).toBe("active");
    expect(nextFramingStatus("draft", false)).toBe("draft");
    expect(nextFramingStatus("active", false)).toBe("paused");
    expect(nextFramingStatus("paused", false)).toBe("paused");
    expect(nextFramingStatus(null, false)).toBe("draft");
  });
});

describe("framingCodeFromName", () => {
  it("makes a lower-case code", () => {
    expect(framingCodeFromName("Natural oak, float mount")).toBe("natural-oak-float-mount");
  });

  it("drops accents and stray punctuation", () => {
    expect(framingCodeFromName("  Café-noir frame! ")).toBe("cafe-noir-frame");
  });

  it("falls back when nothing usable is left", () => {
    expect(framingCodeFromName("???")).toBe("framing-option");
  });
});

describe("framingLeadTimeLabel", () => {
  it("reads as a range, or a single number", () => {
    expect(framingLeadTimeLabel(10, 15)).toBe("10 to 15 working days");
    expect(framingLeadTimeLabel(10, 10)).toBe("10 working days");
  });
});

describe("launch options", () => {
  it("are black, white, natural oak and an oak float mount", () => {
    expect(FRAMING_LAUNCH_OPTIONS.map((option) => option.code)).toEqual([
      "black-wood",
      "white-wood",
      "natural-oak",
      "natural-oak-float",
    ]);
  });

  it("are all valid options, so staff only need to confirm the prices", () => {
    for (const option of FRAMING_LAUNCH_OPTIONS) {
      expect(
        framingOptionIssues({
          name: option.name,
          frame: option.frame,
          mount: option.mount,
          glazing: "uv_acrylic",
          hanging: "d_rings_cord",
          leadTimeMinDays: option.leadTimeMinDays,
          leadTimeMaxDays: option.leadTimeMaxDays,
          pricesPence: option.pricesPence,
        }),
      ).toEqual([]);
    }
  });
});
