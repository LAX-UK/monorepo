import { describe, expect, it } from "vitest";
import { hangLot } from "./hang-fixtures";
import { hangLotPhoto } from "./hang-lot";

describe("hangLotPhoto", () => {
  it("reads the picture's shape and the work's long side", () => {
    expect(hangLotPhoto(hangLot({ dimensions: "80 x 60 cm" }))).toMatchObject({
      imageSrc: "/img/lot-1.jpg",
      aspect: 0.75,
      longSideCm: 80,
      sourceHeightPx: 1600,
      shownFramed: false,
    });
  });

  it("has nothing to draw for a lot with no photograph", () => {
    expect(hangLotPhoto(hangLot({ images: [], imageAssets: [] }))).toBeNull();
  });

  it("never hangs a withdrawn lot", () => {
    expect(hangLotPhoto(hangLot({ status: "cancelled" }))).toBeNull();
  });

  it("has no size when the dimensions cannot be read", () => {
    expect(hangLotPhoto(hangLot({ dimensions: "Size to follow" }))?.longSideCm).toBeNull();
    expect(hangLotPhoto(hangLot({ dimensions: null }))?.longSideCm).toBeNull();
  });

  it("has no size, so the wall goes to salon mode, when the picture's shape is unknown", () => {
    const { imageAssets: _omit, ...withoutAssets } = hangLot();
    const photo = hangLotPhoto(withoutAssets);
    expect(photo?.longSideCm).toBeNull();
    expect(photo?.aspect).toBeGreaterThan(0);
  });

  it("scales by the framed size when the photograph includes the frame", () => {
    const lot = hangLot({ photoIncludesFrame: true, framedWidthCm: 70, framedHeightCm: 96 });
    expect(hangLotPhoto(lot)).toMatchObject({ longSideCm: 96, shownFramed: false });
  });

  it("scales by the work's own size and says it is shown framed when no framed size is set", () => {
    const lot = hangLot({ photoIncludesFrame: true, framedWidthCm: null, framedHeightCm: null });
    expect(hangLotPhoto(lot)).toMatchObject({ longSideCm: 80, shownFramed: true });
  });

  it("ignores a framed size when the photograph does not include the frame", () => {
    const lot = hangLot({ photoIncludesFrame: false, framedWidthCm: 70, framedHeightCm: 96 });
    expect(hangLotPhoto(lot)?.longSideCm).toBe(80);
  });
});
