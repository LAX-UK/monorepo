import type { FramingOption } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  framingFormDefaults,
  framingIssueMessage,
  stillPlaceholder,
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
  pricesPlaceholder: true,
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

  it("will not offer the launch placeholder prices", () => {
    const values = { ...framingFormDefaults(oak), offered: true };
    expect(validateFramingForm(values, oak)).toEqual({
      ok: false,
      errors: {
        offered:
          "Replace the placeholder prices with the framer's prices before offering this option",
      },
    });
  });

  it("offers the option once one price has changed", () => {
    const values = {
      ...framingFormDefaults(oak),
      offered: true,
      prices: { ...oak.pricesPence, up_to_60x80: 21000 },
    };
    expect(validateFramingForm(values, oak).ok).toBe(true);
  });
});

describe("stillPlaceholder", () => {
  it("is false for a new option and for real prices", () => {
    expect(stillPlaceholder(null, oak.pricesPence)).toBe(false);
    expect(stillPlaceholder({ ...oak, pricesPlaceholder: false }, oak.pricesPence)).toBe(false);
  });

  it("holds until a price changes, and while one is cleared", () => {
    expect(stillPlaceholder(oak, oak.pricesPence)).toBe(true);
    expect(stillPlaceholder(oak, { ...oak.pricesPence, up_to_80x100: null })).toBe(true);
    expect(stillPlaceholder(oak, { ...oak.pricesPence, up_to_80x100: 30000 })).toBe(false);
  });
});

describe("framingIssueMessage", () => {
  it("states the allowed range for a price outside it", () => {
    expect(framingIssueMessage({ field: "price:up_to_80x100", reason: "price_invalid" })).toBe(
      "Enter a price from £0.01 to £10,000 for up to 80 × 100 cm",
    );
  });
});
