import type { FramingOption } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  framingFormDefaults,
  framingIssueMessage,
  stillPlaceholderBands,
  validateFramingForm,
} from "./framing-form";

const oak: FramingOption = {
  id: "00000000-0000-4000-8000-0000000000a1",
  code: "natural-oak",
  name: "Natural oak frame",
  frame: "natural_oak",
  mount: "window_conservation",
  glazing: "uv_acrylic",
  hanging: "d_rings_cord",
  leadTimeMinDays: 10,
  leadTimeMaxDays: 15,
  pricesPence: { up_to_40x50: 14000, up_to_60x80: 22500, up_to_80x100: 29500 },
  status: "draft",
  placeholderBands: ["up_to_40x50", "up_to_60x80", "up_to_80x100"],
  editionCount: 0,
  version: "2026-11-01T09:00:00.000Z",
};

describe("framingFormDefaults", () => {
  it("starts a new option empty, not offered, with the first of each choice", () => {
    expect(framingFormDefaults(null)).toMatchObject({
      name: "",
      leadTimeMinDays: "",
      leadTimeMaxDays: "",
      prices: { up_to_40x50: null, up_to_60x80: null, up_to_80x100: null },
      offered: false,
    });
  });

  it("fills an existing option, offered only when it is active", () => {
    expect(framingFormDefaults(oak)).toMatchObject({
      name: "Natural oak frame",
      leadTimeMinDays: "10",
      leadTimeMaxDays: "15",
      offered: false,
    });
    expect(framingFormDefaults({ ...oak, status: "active" }).offered).toBe(true);
    expect(framingFormDefaults({ ...oak, status: "paused" }).offered).toBe(false);
  });
});

describe("validateFramingForm", () => {
  it("returns the body to send, with the name trimmed and days as numbers", () => {
    const values = { ...framingFormDefaults(oak), name: "  Oak  " };
    const result = validateFramingForm(values, oak);
    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        name: "Oak",
        leadTimeMinDays: 10,
        leadTimeMaxDays: 15,
        pricesPence: oak.pricesPence,
        offered: false,
      }),
    });
  });

  it("names each thing to fix, in plain words, once per field", () => {
    const values = {
      ...framingFormDefaults(null),
      leadTimeMinDays: "10",
      prices: { up_to_40x50: 14000, up_to_60x80: null, up_to_80x100: 29500 },
    };
    const result = validateFramingForm(values, null);
    expect(result).toEqual({
      ok: false,
      errors: {
        name: "Enter the name shoppers see",
        leadTimeMaxDays: "Enter the longest lead time, from 1 to 90 working days",
        "price:up_to_60x80": "Enter a price for up to 60 × 80 cm",
      },
    });
  });

  it("treats half-typed days as missing", () => {
    const values = { ...framingFormDefaults(oak), leadTimeMaxDays: "1.5" };
    const result = validateFramingForm(values, oak);
    expect(result.ok).toBe(false);
  });

  it("asks for a longest lead time that is not shorter than the shortest", () => {
    const values = { ...framingFormDefaults(oak), leadTimeMinDays: "15", leadTimeMaxDays: "10" };
    expect(validateFramingForm(values, oak)).toEqual({
      ok: false,
      errors: { leadTimeMaxDays: "The longest lead time cannot be shorter than the shortest" },
    });
  });

  it("will not offer while any band is still a placeholder, and marks each such band", () => {
    const values = { ...framingFormDefaults(oak), offered: true };
    expect(validateFramingForm(values, oak)).toEqual({
      ok: false,
      errors: {
        "price:up_to_40x50":
          "Enter the framer's price for up to 40 × 50 cm, or confirm the price shown, before offering this option",
        "price:up_to_60x80":
          "Enter the framer's price for up to 60 × 80 cm, or confirm the price shown, before offering this option",
        "price:up_to_80x100":
          "Enter the framer's price for up to 80 × 100 cm, or confirm the price shown, before offering this option",
      },
    });
  });

  it("does not offer with one band changed: the other two still need a price", () => {
    const values = {
      ...framingFormDefaults(oak),
      offered: true,
      prices: { ...oak.pricesPence, up_to_60x80: 21000 },
    };
    const result = validateFramingForm(values, oak);
    expect(result.ok).toBe(false);
    expect(Object.keys(result.ok ? {} : result.errors)).toEqual([
      "price:up_to_40x50",
      "price:up_to_80x100",
    ]);
  });

  it("offers once every band is changed or confirmed, and sends the confirmed bands", () => {
    const values = {
      ...framingFormDefaults(oak),
      offered: true,
      prices: { ...oak.pricesPence, up_to_60x80: 21000 },
      confirmedBands: ["up_to_40x50", "up_to_80x100"] as ("up_to_40x50" | "up_to_80x100")[],
    };
    const result = validateFramingForm(values, oak);
    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        offered: true,
        confirmedBands: ["up_to_40x50", "up_to_80x100"],
        pricesPence: { ...oak.pricesPence, up_to_60x80: 21000 },
      }),
    });
  });

  it("lets staff save placeholder prices without offering them", () => {
    expect(validateFramingForm(framingFormDefaults(oak), oak).ok).toBe(true);
  });
});

describe("stillPlaceholderBands", () => {
  it("has none for a new option and for real prices", () => {
    expect(stillPlaceholderBands(null, oak.pricesPence, [])).toEqual([]);
    expect(stillPlaceholderBands({ ...oak, placeholderBands: [] }, oak.pricesPence, [])).toEqual(
      [],
    );
  });

  it("holds every band until its own price changes", () => {
    expect(stillPlaceholderBands(oak, oak.pricesPence, [])).toEqual(oak.placeholderBands);
    expect(stillPlaceholderBands(oak, { ...oak.pricesPence, up_to_80x100: 30000 }, [])).toEqual([
      "up_to_40x50",
      "up_to_60x80",
    ]);
  });

  it("keeps a band while its price is cleared, to be typed again", () => {
    expect(stillPlaceholderBands(oak, { ...oak.pricesPence, up_to_80x100: null }, [])).toEqual(
      oak.placeholderBands,
    );
  });

  it("drops a band the moment staff confirm it", () => {
    expect(stillPlaceholderBands(oak, oak.pricesPence, ["up_to_60x80"])).toEqual([
      "up_to_40x50",
      "up_to_80x100",
    ]);
    expect(
      stillPlaceholderBands(oak, { ...oak.pricesPence, up_to_80x100: null }, ["up_to_60x80"]),
    ).toEqual(["up_to_40x50", "up_to_80x100"]);
  });
});

describe("framingIssueMessage", () => {
  it("states the allowed range for a price outside it", () => {
    expect(framingIssueMessage({ field: "price:up_to_80x100", reason: "price_invalid" })).toBe(
      "Enter a price from £0.01 to £10,000 for up to 80 × 100 cm",
    );
  });
});
