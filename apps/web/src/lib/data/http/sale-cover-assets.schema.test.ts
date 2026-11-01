import { describe, expect, it } from "vitest";
import { parseSaleCoverSlotAssets } from "./sale-cover-assets.schema";
import { parseSaleSchema } from "./sale.schema";

const slot = (over: Record<string, unknown> = {}) => ({
  src: "https://cdn.test/cover.jpg",
  width: 3200,
  height: 1400,
  focal: { x: 0.7, y: 0.5 },
  zoom: 1.2,
  alt: "Estuary, Evening",
  lotId: "lot-4",
  side: "left",
  analysisStatus: "ready",
  colours: { dominant: "#3e6a86", deepest: "#162936", field: "#162936" },
  scrim: { desktop: { tone: "light", strength: 0.5, creditBand: 0.4 }, wide: null },
  ...over,
});

describe("parseSaleCoverSlotAssets", () => {
  it("keeps a valid slot with its measured scrim", () => {
    const parsed = parseSaleCoverSlotAssets({ default: slot() });
    expect(parsed?.default?.scrim.desktop).toEqual({
      tone: "light",
      strength: 0.5,
      creditBand: 0.4,
    });
    expect(parsed?.default?.lotId).toBe("lot-4");
  });

  it("leaves out a slot that does not match, so the cover falls to its next source", () => {
    const parsed = parseSaleCoverSlotAssets({ default: slot(), wide: slot({ zoom: 9 }), phone: 4 });
    expect(Object.keys(parsed ?? {})).toEqual(["default"]);
  });

  it("is undefined when nothing is usable", () => {
    expect(parseSaleCoverSlotAssets(undefined)).toBeUndefined();
    expect(parseSaleCoverSlotAssets({ default: { src: "" } })).toBeUndefined();
  });
});

describe("sale rows carry the home cover fields", () => {
  const row = {
    id: "s1",
    title: "Sale",
    status: "active",
    startTime: "2026-11-01T10:00:00Z",
    endTime: "2026-11-03T10:00:00Z",
    createdAt: "2026-10-01T10:00:00Z",
    updatedAt: "2026-10-01T10:00:00Z",
  };

  it("reads the subtitle, pin, consignment deadline and cover slots", () => {
    const sale = parseSaleSchema({
      ...row,
      subtitle: "British paintings",
      homePinOrder: 2,
      consignmentDeadline: "2026-12-04T00:00:00Z",
      coverSlotAssets: { default: slot() },
    });
    expect(sale.subtitle).toBe("British paintings");
    expect(sale.homePinOrder).toBe(2);
    expect(sale.consignmentDeadline).toEqual(new Date("2026-12-04T00:00:00Z"));
    expect(sale.coverSlotAssets?.default?.alt).toBe("Estuary, Evening");
  });

  it("reads absent fields as none", () => {
    const sale = parseSaleSchema(row);
    expect(sale.subtitle).toBeNull();
    expect(sale.homePinOrder).toBeNull();
    expect(sale.consignmentDeadline).toBeNull();
    expect(sale.coverSlotAssets).toBeUndefined();
  });
});
