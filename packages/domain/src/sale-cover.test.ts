import type { SaleCoverSlot } from "@auction/types";
import { describe, expect, it } from "vitest";
import { assembleCoverAnalysis } from "./cover-analysis.js";
import { coverCrop, cropKeepsArea, suggestCoverSide } from "./cover-crop.js";
import {
  COVER_ANALYSIS_VERSION,
  coverAnalysisHash,
  effectiveCoverSide,
  effectiveCoverSize,
  resolveCoverSlotSources,
  slotScrimSettings,
  validateCoverSlot,
} from "./sale-cover.js";
import { canPinToHome, featuredLotsRefusal, homePinsRefusal } from "./sale-home.js";

const slot = (overrides: Partial<SaleCoverSlot> = {}): SaleCoverSlot => ({
  key: "uploads/cover.jpg",
  width: 3200,
  height: 1400,
  focal: { x: 0.7, y: 0.5 },
  zoom: 1,
  alt: "A harbour at dusk",
  analysisHash: "",
  ...overrides,
});

describe("cover crop", () => {
  it("fills the box and puts the focal point on the far third from the text", () => {
    const crop = coverCrop({
      image: { width: 3000, height: 2000 },
      box: { width: 1440, height: 640 },
      focal: { x: 0.7, y: 0.5 },
      zoom: 1,
      textSide: "left",
    });
    expect(crop.width).toBe(1);
    expect(crop.height).toBeCloseTo(640 / 1440 / (2000 / 3000), 5);
    expect(crop.y).toBeCloseTo((1 - crop.height) / 2, 5);
  });

  it("shows a smaller part of the picture as the zoom grows, never leaving the picture", () => {
    const crop = coverCrop({
      image: { width: 3000, height: 2000 },
      box: { width: 1440, height: 640 },
      focal: { x: 0.95, y: 0.05 },
      zoom: 2,
      textSide: "left",
    });
    expect(crop.width).toBeCloseTo(0.5, 5);
    expect(crop.x).toBeGreaterThanOrEqual(0);
    expect(crop.y).toBeGreaterThanOrEqual(0);
    expect(crop.x + crop.width).toBeLessThanOrEqual(1 + 1e-9);
    expect(crop.y + crop.height).toBeLessThanOrEqual(1 + 1e-9);
  });

  it("centres the focal point on the phone plate", () => {
    const crop = coverCrop({
      image: { width: 3000, height: 2000 },
      box: { width: 375, height: 340 },
      focal: { x: 0.5, y: 0.5 },
      zoom: 1.5,
      textSide: null,
    });
    expect(crop.x + crop.width / 2).toBeCloseTo(0.5, 5);
  });

  it("suggests the text side away from a subject on the left", () => {
    expect(suggestCoverSide({ x: 0.2, y: 0.5 })).toBe("right");
    expect(suggestCoverSide({ x: 0.5, y: 0.5 })).toBe("left");
  });

  it("tells whether the keep area is inside the crop", () => {
    const crop = { x: 0, y: 0.2, width: 1, height: 0.5 };
    expect(cropKeepsArea(crop, { x: 0.2, y: 0.3, width: 0.3, height: 0.2 })).toBe(true);
    expect(cropKeepsArea(crop, { x: 0.2, y: 0.1, width: 0.3, height: 0.2 })).toBe(false);
  });
});

describe("slot checks", () => {
  it("accepts a picture at the floor and refuses one below it", () => {
    expect(
      validateCoverSlot("default", slot({ width: 2400 }), { phoneSlotPresent: false }),
    ).toEqual([]);
    const issues = validateCoverSlot("default", slot({ width: 2399 }), { phoneSlotPresent: true });
    expect(issues).toEqual([
      expect.objectContaining({ code: "below_floor", need: { width: 2400, height: 0 } }),
    ]);
  });

  it("holds the wide slot to 2880 by 1080 and the phone slot to 1200 square", () => {
    expect(
      validateCoverSlot("wide", slot({ width: 2880, height: 1080 }), { phoneSlotPresent: false }),
    ).toEqual([]);
    expect(
      validateCoverSlot("wide", slot({ width: 2880, height: 1079 }), { phoneSlotPresent: false }),
    ).toHaveLength(1);
    expect(
      validateCoverSlot("phone", slot({ width: 1200, height: 1200 }), { phoneSlotPresent: true }),
    ).toEqual([]);
    expect(
      validateCoverSlot("phone", slot({ width: 1200, height: 1199 }), { phoneSlotPresent: true }),
    ).toHaveLength(1);
  });

  it("measures the size after the zoom has chosen the detail", () => {
    expect(effectiveCoverSize(slot({ width: 3600, height: 2400, zoom: 1.5 }))).toEqual({
      width: 2400,
      height: 1600,
    });
    const issues = validateCoverSlot("default", slot({ width: 3600, zoom: 1.6 }), {
      phoneSlotPresent: true,
    });
    expect(issues[0]?.code).toBe("below_floor");
  });

  it("rejects a crop that cuts the keep area", () => {
    const wideBanner = slot({
      width: 4000,
      height: 1000,
      keep: { x: 0.02, y: 0.1, width: 0.2, height: 0.8 },
    });
    const issues = validateCoverSlot("default", wideBanner, { phoneSlotPresent: true });
    expect(issues.some((issue) => issue.code === "keep_area_cut")).toBe(true);
  });

  it("accepts a keep area the crops contain", () => {
    const issues = validateCoverSlot(
      "default",
      slot({ width: 3000, height: 2000, keep: { x: 0.4, y: 0.4, width: 0.2, height: 0.1 } }),
      { phoneSlotPresent: true },
    );
    expect(issues).toEqual([]);
  });

  it("checks the phone crop for the default slot only when there is no phone slot", () => {
    const tallKeep = slot({
      width: 3000,
      height: 2000,
      focal: { x: 0.5, y: 0.5 },
      keep: { x: 0.05, y: 0.45, width: 0.9, height: 0.1 },
    });
    expect(validateCoverSlot("default", tallKeep, { phoneSlotPresent: true })).toEqual([]);
    expect(
      validateCoverSlot("default", tallKeep, { phoneSlotPresent: false }).map((i) => i.code),
    ).toContain("keep_area_cut");
  });
});

describe("reading slots and the old array", () => {
  it("fills the named slots from the array positions", () => {
    const sources = resolveCoverSlotSources(undefined, ["a.jpg", "b.jpg", "c.jpg"]);
    expect(sources.default).toEqual({ kind: "legacy", key: "a.jpg" });
    expect(sources.phone).toEqual({ kind: "legacy", key: "b.jpg" });
    expect(sources.wide).toEqual({ kind: "legacy", key: "c.jpg" });
  });

  it("lets a stored slot win and leaves a missing position empty", () => {
    const stored = slot();
    const sources = resolveCoverSlotSources({ default: stored }, ["a.jpg"]);
    expect(sources.default).toEqual({ kind: "slot", slot: stored });
    expect(sources.phone).toBeUndefined();
    expect(sources.wide).toBeUndefined();
  });

  it("ignores blank positions", () => {
    expect(resolveCoverSlotSources(undefined, ["a.jpg", "  "]).phone).toBeUndefined();
  });
});

describe("analysis fingerprint", () => {
  it("changes with the crop and the side but not the tone override or the alt text", () => {
    const base = coverAnalysisHash("default", slot());
    expect(coverAnalysisHash("default", slot({ alt: "Something else" }))).toBe(base);
    expect(coverAnalysisHash("default", slot({ toneOverride: "dark" }))).toBe(base);
    expect(coverAnalysisHash("default", slot({ zoom: 1.2 }))).not.toBe(base);
    expect(coverAnalysisHash("default", slot({ focal: { x: 0.6, y: 0.5 } }))).not.toBe(base);
    expect(coverAnalysisHash("default", slot({ sideOverride: "right" }))).not.toBe(base);
    expect(coverAnalysisHash("default", slot({ key: "uploads/other.jpg" }))).not.toBe(base);
    expect(coverAnalysisHash("wide", slot())).not.toBe(base);
  });

  it("is stable and the same for slots that mean the same crop", () => {
    expect(coverAnalysisHash("default", slot())).toBe(coverAnalysisHash("default", slot()));
    expect(coverAnalysisHash("default", slot({ focal: { x: 0.70001, y: 0.5 } }))).toBe(
      coverAnalysisHash("default", slot()),
    );
    expect(effectiveCoverSide(slot({ focal: { x: 0.1, y: 0.5 } }))).toBe("right");
  });

  it("tells a lot detail from an upload", () => {
    const fromLot = slot({
      key: undefined,
      fromLot: { lotId: "lot-1", imageKey: "uploads/cover.jpg" },
    });
    expect(coverAnalysisHash("default", fromLot)).not.toBe(coverAnalysisHash("default", slot()));
  });
});

describe("assembling the analysis", () => {
  const zones = Object.fromEntries(
    ["eyebrow", "title", "sub", "link", "credit"].map((line) => [
      line,
      { brightest: "#303030", darkest: "#101010" },
    ]),
  ) as never;

  it("solves each measured size and derives the plate field", () => {
    const analysis = assembleCoverAnalysis(
      {
        dominant: [120, 90, 60],
        deepest: [150, 120, 90],
        blurDataURL: "data:image/jpeg;base64,AAAA",
        zones: { desktop: zones, wide: zones },
      },
      "left",
    );
    expect(analysis.version).toBe(COVER_ANALYSIS_VERSION);
    expect(analysis.dominant).toBe("#785a3c");
    expect(analysis.breakpoints.desktop?.recommended).toBe("light");
    expect(analysis.breakpoints.wide?.recommended).toBe("light");
    expect(analysis.field).not.toBe(analysis.deepest);
  });

  it("applies the slot's tone override when reading the scrim", () => {
    const analysis = assembleCoverAnalysis(
      {
        dominant: [10, 10, 10],
        deepest: [5, 5, 5],
        blurDataURL: "data:image/jpeg;base64,AAAA",
        zones: { desktop: zones },
      },
      "left",
    );
    const settings = slotScrimSettings("default", {}, analysis);
    expect(settings.desktop?.tone).toBe("light");
    expect(slotScrimSettings("phone", {}, analysis)).toEqual({});
  });
});

describe("home page rules", () => {
  it("pins only sales people can see", () => {
    expect(canPinToHome("active")).toBe(true);
    expect(canPinToHome("scheduled")).toBe(true);
    expect(canPinToHome("draft")).toBe(false);
    expect(canPinToHome("cancelled")).toBe(false);
  });

  it("allows three pins, each once", () => {
    const status = () => "active" as const;
    expect(homePinsRefusal(["a", "b", "c"], status)).toBeNull();
    expect(homePinsRefusal(["a", "b", "c", "d"], status)).toEqual({ code: "too_many", max: 3 });
    expect(homePinsRefusal(["a", "a"], status)).toEqual({ code: "duplicate", saleId: "a" });
    expect(homePinsRefusal(["a"], () => "draft")).toEqual({ code: "not_pinnable", saleId: "a" });
    expect(homePinsRefusal(["a"], () => undefined)).toEqual({ code: "not_pinnable", saleId: "a" });
  });

  it("allows twelve featured lots from the sale, each once", () => {
    const inSale = new Set(["l1", "l2", "l3"]);
    expect(featuredLotsRefusal(["l2", "l1"], inSale)).toBeNull();
    expect(featuredLotsRefusal(["l1", "l1"], inSale)).toEqual({ code: "duplicate", lotId: "l1" });
    expect(featuredLotsRefusal(["x"], inSale)).toEqual({ code: "not_in_sale", lotId: "x" });
    const many = Array.from({ length: 13 }, (_, i) => `l${i}`);
    expect(featuredLotsRefusal(many, new Set(many))).toEqual({ code: "too_many", max: 12 });
  });
});
