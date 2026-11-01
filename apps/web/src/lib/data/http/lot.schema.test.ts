import { describe, expect, it } from "vitest";
import { parseLotSchema } from "./lot.schema";

const baseRow = {
  id: "lot-1",
  title: "Harbour",
  currentPrice: "100.00",
  startTime: "2026-11-03T10:00:00.000Z",
  endTime: "2026-11-03T21:00:00.000Z",
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
  status: "active",
};

describe("parseLotSchema: hang fields", () => {
  it("reads the frame flag, the framed size and the picture sizes", () => {
    const lot = parseLotSchema({
      ...baseRow,
      images: ["/a.jpg"],
      imageAssets: [{ src: "/a.jpg", width: 1200, height: 1600 }],
      photoIncludesFrame: true,
      framedWidthCm: "70.5",
      framedHeightCm: 96,
    });
    expect(lot.photoIncludesFrame).toBe(true);
    expect(lot.framedWidthCm).toBe(70.5);
    expect(lot.framedHeightCm).toBe(96);
    expect(lot.imageAssets).toEqual([{ src: "/a.jpg", width: 1200, height: 1600 }]);
  });

  it("defaults to no frame, no framed size and no picture sizes", () => {
    const lot = parseLotSchema({ ...baseRow, images: [] });
    expect(lot.photoIncludesFrame).toBe(false);
    expect(lot.framedWidthCm).toBeNull();
    expect(lot.framedHeightCm).toBeNull();
    expect(lot.imageAssets).toBeUndefined();
  });

  it("treats a zero or unreadable framed size as not set", () => {
    const lot = parseLotSchema({ ...baseRow, images: [], framedWidthCm: 0, framedHeightCm: "x" });
    expect(lot.framedWidthCm).toBeNull();
    expect(lot.framedHeightCm).toBeNull();
  });
});
