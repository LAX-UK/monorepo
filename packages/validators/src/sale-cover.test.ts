import { describe, expect, it } from "vitest";
import { updateLotSchema } from "./lot/create-update.js";
import {
  replaceHomePinsBodySchema,
  setSaleCoverSlotBodySchema,
  unitRectSchema,
  updateSaleHomeBodySchema,
} from "./sale-cover.js";

const base = {
  source: { kind: "upload", key: "uploads/cover.jpg" },
  focal: { x: 0.7, y: 0.5 },
  alt: "A harbour at dusk",
};

describe("cover slot body", () => {
  it("defaults the zoom to 1 and trims the alt text", () => {
    const parsed = setSaleCoverSlotBodySchema.parse({ ...base, alt: "  A harbour  " });
    expect(parsed.zoom).toBe(1);
    expect(parsed.alt).toBe("A harbour");
  });

  it("keeps the focal point and zoom in range", () => {
    for (const bad of [
      { focal: { x: -0.1, y: 0.5 } },
      { focal: { x: 0.5, y: 1.1 } },
      { zoom: 0.9 },
      { zoom: 2.51 },
      { alt: "" },
      { toneOverride: "grey" },
      { sideOverride: "centre" },
    ]) {
      expect(setSaleCoverSlotBodySchema.safeParse({ ...base, ...bad }).success).toBe(false);
    }
    expect(setSaleCoverSlotBodySchema.safeParse({ ...base, zoom: 2.5 }).success).toBe(true);
  });

  it("accepts storage keys only, never web addresses", () => {
    for (const key of ["https://example.com/a.jpg", "http://a/b.jpg", "../x.jpg", ""]) {
      expect(
        setSaleCoverSlotBodySchema.safeParse({ ...base, source: { kind: "upload", key } }).success,
      ).toBe(false);
    }
  });

  it("takes a lot detail by lot and picture position, with an optional crop", () => {
    const lot = {
      ...base,
      source: {
        kind: "lot",
        lotId: "0b8f7a31-4c52-4f0e-9d63-1a7c2e5b9d40",
        imageIndex: 2,
        crop: { x: 0.1, y: 0.1, width: 0.5, height: 0.5 },
      },
    };
    expect(setSaleCoverSlotBodySchema.safeParse(lot).success).toBe(true);
    expect(
      setSaleCoverSlotBodySchema.safeParse({ ...lot, source: { ...lot.source, imageIndex: -1 } })
        .success,
    ).toBe(false);
    expect(
      setSaleCoverSlotBodySchema.safeParse({ ...lot, source: { ...lot.source, lotId: "nope" } })
        .success,
    ).toBe(false);
  });

  it("keeps the keep-in-frame area inside the picture", () => {
    expect(unitRectSchema.safeParse({ x: 0.1, y: 0.1, width: 0.5, height: 0.5 }).success).toBe(
      true,
    );
    expect(unitRectSchema.safeParse({ x: 0.6, y: 0, width: 0.5, height: 0.5 }).success).toBe(false);
    expect(unitRectSchema.safeParse({ x: 0, y: 0, width: 0, height: 0.5 }).success).toBe(false);
  });
});

describe("home fields", () => {
  it("needs at least one change and limits the subtitle and the featured lots", () => {
    expect(updateSaleHomeBodySchema.safeParse({}).success).toBe(false);
    expect(updateSaleHomeBodySchema.safeParse({ subtitle: "x".repeat(160) }).success).toBe(true);
    expect(updateSaleHomeBodySchema.safeParse({ subtitle: "x".repeat(161) }).success).toBe(false);
    const ids = Array.from(
      { length: 13 },
      (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    );
    expect(updateSaleHomeBodySchema.safeParse({ featuredLotIds: ids.slice(0, 12) }).success).toBe(
      true,
    );
    expect(updateSaleHomeBodySchema.safeParse({ featuredLotIds: ids }).success).toBe(false);
  });

  it("reads the deadline as a date and clears it with null", () => {
    const parsed = updateSaleHomeBodySchema.parse({ consignmentDeadline: "2026-12-01T00:00:00Z" });
    expect(parsed.consignmentDeadline).toBeInstanceOf(Date);
    expect(
      updateSaleHomeBodySchema.parse({ consignmentDeadline: null }).consignmentDeadline,
    ).toBeNull();
  });

  it("allows three pins", () => {
    const ids = ["a", "b", "c", "d"].map((c) => `${c.repeat(8)}-1111-4111-8111-111111111111`);
    expect(replaceHomePinsBodySchema.safeParse({ saleIds: ids.slice(0, 3) }).success).toBe(true);
    expect(replaceHomePinsBodySchema.safeParse({ saleIds: ids }).success).toBe(false);
    expect(replaceHomePinsBodySchema.safeParse({ saleIds: [] }).success).toBe(true);
  });
});

describe("lot framing", () => {
  it("takes the frame flag and a framed size as a pair", () => {
    expect(
      updateLotSchema.safeParse({
        photoIncludesFrame: true,
        framedWidthCm: 62.5,
        framedHeightCm: 82,
      }).success,
    ).toBe(true);
    expect(updateLotSchema.safeParse({ framedWidthCm: 62.5 }).success).toBe(false);
    expect(updateLotSchema.safeParse({ framedHeightCm: 40 }).success).toBe(false);
    expect(updateLotSchema.safeParse({ framedWidthCm: null, framedHeightCm: null }).success).toBe(
      true,
    );
    expect(updateLotSchema.safeParse({ framedWidthCm: 0, framedHeightCm: 10 }).success).toBe(false);
    expect(updateLotSchema.safeParse({ photoIncludesFrame: false }).success).toBe(true);
  });
});
