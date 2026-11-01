import { describe, expect, it } from "vitest";
import {
  HANG_DESKTOP_FIT_PX,
  type HangWorkInput,
  chooseScaleBar,
  hangSalonReason,
  resolveHangLongSide,
  solveHangLayout,
} from "./hang-layout.js";

const work = (id: string, longSideCm: number | null, aspect = 0.8): HangWorkInput => ({
  id,
  aspect,
  longSideCm,
});

describe("solveHangLayout: scale", () => {
  it("makes the tallest work 300px on desktop and 180px on a phone", () => {
    const works = [work("a", 100), work("b", 50)];
    const desktop = solveHangLayout(works, { viewport: "desktop" });
    const phone = solveHangLayout(works, { viewport: "phone" });
    expect(Math.max(...desktop.items.map((i) => i.height))).toBe(300);
    expect(Math.max(...phone.items.map((i) => i.height))).toBe(180);
    expect(desktop.pxPerCm).toBeCloseTo(3);
    expect(phone.pxPerCm).toBeCloseTo(1.8);
  });

  it("uses one factor for every work, so a half-size work is half as tall", () => {
    const layout = solveHangLayout([work("a", 100), work("b", 50)], { viewport: "desktop" });
    expect(layout.mode).toBe("scale");
    expect(layout.items).toEqual([
      { id: "a", width: 240, height: 300 },
      { id: "b", width: 120, height: 150 },
    ]);
  });

  it("sizes a landscape work by its long side across", () => {
    const layout = solveHangLayout([work("wide", 120, 1.5), work("tall", 80, 0.5)], {
      viewport: "desktop",
    });
    const [wide, tall] = layout.items;
    // The 80 cm portrait is the tallest (80 cm vs 80 cm high for the landscape), k = 300 / 80.
    expect(tall?.height).toBe(300);
    expect(wide?.width).toBe(450);
    expect(wide?.height).toBe(300);
  });

  it("gives every work the same slot height so labels share a line", () => {
    const layout = solveHangLayout([work("a", 100), work("b", 40)], { viewport: "desktop" });
    expect(layout.slotHeight).toBe(300);
  });

  it("shrinks the factor until a short row fits the room", () => {
    const works = [work("a", 200, 1), work("b", 200, 1), work("c", 200, 1), work("d", 200, 1)];
    const fitted = solveHangLayout(works, { viewport: "desktop", fitWidth: HANG_DESKTOP_FIT_PX });
    const total = fitted.items.reduce((sum, i) => sum + Math.max(i.width, 168), 0) + 56 * 3;
    expect(total).toBeLessThanOrEqual(HANG_DESKTOP_FIT_PX + 4);
    expect(fitted.pxPerCm).toBeLessThan(1.5);
  });

  it("never draws a work more than two thirds of its source height", () => {
    const small: HangWorkInput = { ...work("a", 100), sourceHeightPx: 300 };
    const layout = solveHangLayout([small], { viewport: "desktop" });
    expect(layout.items[0]?.height).toBe(200);
  });
});

describe("solveHangLayout: salon mode", () => {
  it("switches to equal heights when any size is missing", () => {
    const layout = solveHangLayout([work("a", 100), work("b", null, 1.25)], {
      viewport: "desktop",
    });
    expect(layout.mode).toBe("salon");
    expect(layout.salonReason).toBe("missing-size");
    expect(layout.pxPerCm).toBeNull();
    expect(layout.scaleBar).toBeNull();
    expect(layout.items.map((i) => i.height)).toEqual([220, 220]);
    expect(layout.items[1]?.width).toBe(275);
  });

  it("uses 150px on a phone", () => {
    const layout = solveHangLayout([work("a", null), work("b", null)], { viewport: "phone" });
    expect(layout.items.every((i) => i.height === 150)).toBe(true);
  });

  it("switches when the largest is more than five times the smallest", () => {
    expect(hangSalonReason([work("a", 100), work("b", 19)])).toBe("wide-range");
    expect(hangSalonReason([work("a", 100), work("b", 20)])).toBeNull();
  });

  it("treats a zero or non-numeric size as missing", () => {
    expect(hangSalonReason([work("a", 0)])).toBe("missing-size");
    expect(hangSalonReason([work("a", Number.NaN)])).toBe("missing-size");
  });

  it("narrows the heights to fit a short row", () => {
    const works = Array.from({ length: 5 }, (_, i) => work(`w${i}`, null, 1.5));
    const layout = solveHangLayout(works, { viewport: "desktop", fitWidth: 1300 });
    const total = layout.items.reduce((sum, i) => sum + Math.max(i.width, 168), 0) + 56 * 4;
    expect(layout.slotHeight).toBeLessThan(220);
    expect(total).toBeLessThanOrEqual(1300);
  });
});

describe("scale bar", () => {
  it.each([
    [3, 50],
    [0.6, 100],
    [10, 10],
    [1.8, 50],
    [5, 25],
  ])("at %s px per cm picks %s cm", (k, cm) => {
    expect(chooseScaleBar(k).cm).toBe(cm);
  });

  it("draws the bar at the real length of the chosen distance", () => {
    expect(chooseScaleBar(3)).toEqual({ cm: 50, widthPx: 150 });
  });

  it("comes with the layout in scale mode only", () => {
    expect(solveHangLayout([work("a", 100)], { viewport: "desktop" }).scaleBar).toEqual({
      cm: 50,
      widthPx: 150,
    });
  });
});

describe("one work with a figure", () => {
  it("hangs a 170 cm figure beside the work at the same factor", () => {
    const layout = solveHangLayout([work("a", 100)], { viewport: "desktop", figure: true });
    // The 170 cm figure is the tallest thing on the wall, so it is 300px and the work is 176px.
    expect(layout.figure).toEqual({ width: 81, height: 300 });
    expect(layout.items[0]?.height).toBe(176);
    expect(layout.slotHeight).toBe(300);
    expect(layout.scaleBar).not.toBeNull();
  });

  it("has no figure unless asked for, or with more than one work", () => {
    expect(solveHangLayout([work("a", 100)], { viewport: "desktop" }).figure).toBeNull();
    expect(
      solveHangLayout([work("a", 100), work("b", 90)], { viewport: "desktop", figure: true })
        .figure,
    ).toBeNull();
  });

  it("has no figure in salon mode, where there is no scale to compare against", () => {
    expect(
      solveHangLayout([work("a", null)], { viewport: "desktop", figure: true }).figure,
    ).toBeNull();
  });
});

describe("framed size", () => {
  it("scales by the framed size when the photograph includes the frame", () => {
    expect(resolveHangLongSide(80, { photoIncludesFrame: true, framedLongSideCm: 96 })).toEqual({
      longSideCm: 96,
      shownFramed: false,
    });
  });

  it("scales by the work's own size and says it is shown framed when no framed size is set", () => {
    expect(resolveHangLongSide(80, { photoIncludesFrame: true, framedLongSideCm: null })).toEqual({
      longSideCm: 80,
      shownFramed: true,
    });
  });

  it("ignores a framed size when the photograph does not include the frame", () => {
    expect(resolveHangLongSide(80, { photoIncludesFrame: false, framedLongSideCm: 96 })).toEqual({
      longSideCm: 80,
      shownFramed: false,
    });
  });
});

describe("empty wall", () => {
  it("has nothing to lay out", () => {
    const layout = solveHangLayout([], { viewport: "desktop" });
    expect(layout.items).toEqual([]);
    expect(layout.scaleBar).toBeNull();
  });
});
