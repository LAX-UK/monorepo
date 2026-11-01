import type { CoverTextLine, CoverZoneSample } from "@auction/types";
import { COVER_TEXT_LINES } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  parseHex,
  plateFieldColour,
  relativeLuminance,
  toHex,
} from "./cover-colour.js";
import {
  CREDIT_BAND_CAP,
  LINE_MIN_CONTRAST,
  SCRIM_STRENGTH_CAP,
  SCRIM_STRENGTH_FLOOR,
  chooseTone,
  coverZoneRect,
  lineScrimAlpha,
  scrimSettingFor,
  solveCoverScrim,
} from "./cover-scrim.js";

type Zones = Record<CoverTextLine, CoverZoneSample>;

const uniform = (brightest: string, darkest = brightest): Zones =>
  Object.fromEntries(COVER_TEXT_LINES.map((line) => [line, { brightest, darkest }])) as Zones;

describe("colour maths", () => {
  it("matches the WCAG reference ratios", () => {
    expect(contrastRatio(parseHex("#000000"), parseHex("#ffffff"))).toBeCloseTo(21, 5);
    expect(contrastRatio(parseHex("#767676"), parseHex("#ffffff"))).toBeCloseTo(4.54, 2);
    expect(relativeLuminance(parseHex("#ffffff"))).toBeCloseTo(1, 5);
  });

  it("round-trips hex colours", () => {
    expect(toHex(parseHex("#a1b2c3"))).toBe("#a1b2c3");
    expect(() => parseHex("blue")).toThrow();
  });

  it("darkens a plate field until white reads at 13:1", () => {
    const field = plateFieldColour(parseHex("#8899aa"));
    expect(contrastRatio([255, 255, 255], field)).toBeGreaterThanOrEqual(13);
    const alreadyDark = parseHex("#101111");
    expect(plateFieldColour(alreadyDark)).toEqual(alreadyDark);
  });
});

describe("where the type sits", () => {
  it("puts the credit opposite the text and mirrors the text for the right", () => {
    const title = coverZoneRect("desktop", "title", "left");
    const credit = coverZoneRect("desktop", "credit", "left");
    expect(title.x).toBe(40);
    expect(credit.x + credit.width).toBe(1440 - 40);

    const titleRight = coverZoneRect("desktop", "title", "right");
    expect(titleRight.x + titleRight.width).toBe(1440 - 40);
    expect(coverZoneRect("desktop", "credit", "right").x).toBe(40);
  });

  it("keeps the same offsets from the bottom at every hero height", () => {
    const desktop = coverZoneRect("desktop", "link", "left");
    const wide = coverZoneRect("wide", "link", "left");
    expect(720 - (wide.y + wide.height)).toBe(640 - (desktop.y + desktop.height));
  });

  it("is strongest under the text corner and fades away from it", () => {
    const near = lineScrimAlpha("desktop", "link", "left", 0.8, 0);
    const far = lineScrimAlpha("desktop", "eyebrow", "left", 0.8, 0);
    expect(near).toBeGreaterThan(far);
    expect(lineScrimAlpha("desktop", "credit", "left", 0.8, 0)).toBe(0);
  });

  it("lets the band carry the credit line", () => {
    expect(lineScrimAlpha("desktop", "credit", "left", 0.5, 0.9)).toBeGreaterThan(0.3);
  });
});

describe("solving the scrim", () => {
  it("needs no more than the floor on a dark picture and keeps white type", () => {
    const result = solveCoverScrim("desktop", "left", uniform("#1c1f24"));
    expect(result.recommended).toBe("light");
    expect(result.light?.rawStrength).toBe(0);
    expect(result.light?.strength).toBe(SCRIM_STRENGTH_FLOOR);
  });

  it("builds a stronger scrim for a brighter picture", () => {
    const mid = solveCoverScrim("desktop", "left", uniform("#707070"));
    const bright = solveCoverScrim("desktop", "left", uniform("#a0a0a0"));
    expect(mid.light).not.toBeNull();
    expect(bright.light).not.toBeNull();
    expect(bright.light?.rawStrength).toBeGreaterThan(mid.light?.rawStrength ?? 1);
  });

  it("returns a scrim at which every line passes its own threshold", () => {
    for (const hex of ["#2b2b2b", "#555555", "#808080", "#a0a0a0", "#c8c8c8"]) {
      for (const side of ["left", "right"] as const) {
        const result = solveCoverScrim("wide", side, uniform(hex));
        const solution = result.recommended ? result[result.recommended] : null;
        expect(solution, `${hex} ${side}`).not.toBeNull();
        for (const line of COVER_TEXT_LINES) {
          expect(solution?.contrast[line]).toBeGreaterThanOrEqual(LINE_MIN_CONTRAST[line]);
        }
      }
    }
  });

  it("holds the strength between the floor and the cap, and the band under its cap", () => {
    for (const hex of ["#000000", "#404040", "#909090", "#d0d0d0"]) {
      const { light, dark } = solveCoverScrim("desktop", "left", uniform(hex));
      for (const solution of [light, dark]) {
        if (!solution) continue;
        expect(solution.strength).toBeGreaterThanOrEqual(SCRIM_STRENGTH_FLOOR);
        expect(solution.strength).toBeLessThanOrEqual(SCRIM_STRENGTH_CAP);
        expect(solution.creditBand).toBeLessThanOrEqual(CREDIT_BAND_CAP);
      }
    }
  });

  it("checks the title at 3:1 and the small lines at 4.5:1", () => {
    expect(LINE_MIN_CONTRAST.title).toBe(3);
    for (const line of ["eyebrow", "sub", "link", "credit"] as const) {
      expect(LINE_MIN_CONTRAST[line]).toBe(4.5);
    }
  });

  it("uses the credit band when the picture is bright under the credit line", () => {
    const zones = uniform("#1c1f24");
    zones.credit = { brightest: "#8a8a8a", darkest: "#8a8a8a" };
    const { light } = solveCoverScrim("desktop", "left", zones);
    expect(light?.creditBand).toBeGreaterThan(0.3);
    expect(light).not.toBeNull();
    expect(light?.contrast.credit).toBeGreaterThanOrEqual(4.5);
  });

  it("measures dark type against the darkest part of a zone", () => {
    const zones = uniform("#fafafa", "#fafafa");
    zones.title = { brightest: "#fafafa", darkest: "#6a6a6a" };
    const { dark } = solveCoverScrim("desktop", "left", zones);
    expect(dark).not.toBeNull();
    expect(dark?.contrast.title).toBeGreaterThanOrEqual(3);
  });

  it("gives up when the credit line sits on a picture the band cannot darken enough", () => {
    const zones = uniform("#1c1f24");
    zones.credit = { brightest: "#ffffff", darkest: "#ffffff" };
    expect(solveCoverScrim("desktop", "left", zones).light).toBeNull();
  });

  it("gives up on a tone it cannot make pass within the cap", () => {
    const midGrey = solveCoverScrim("desktop", "left", {
      ...uniform("#ffffff", "#000000"),
    });
    expect(midGrey.light).toBeNull();
    expect(midGrey.dark).toBeNull();
    expect(midGrey.recommended).toBeNull();
  });
});

describe("choosing the tone", () => {
  const solution = (rawStrength: number) => ({
    strength: Math.max(0.45, rawStrength),
    creditBand: 0,
    rawStrength,
    contrast: { eyebrow: 5, title: 5, sub: 5, link: 5, credit: 5 },
  });

  it("keeps white type unless dark type needs a clearly weaker scrim", () => {
    expect(chooseTone(solution(0.5), solution(0.45))).toBe("light");
    expect(chooseTone(solution(0.5), solution(0.38))).toBe("dark");
    expect(chooseTone(solution(0.5), solution(0.3))).toBe("dark");
  });

  it("uses the only tone that passes, or none", () => {
    expect(chooseTone(solution(0.9 - 0.1), null)).toBe("light");
    expect(chooseTone(null, solution(0.7))).toBe("dark");
    expect(chooseTone(null, null)).toBeNull();
  });

  it("prefers dark type on a pale picture", () => {
    const result = solveCoverScrim("desktop", "left", uniform("#f4f1ea"));
    expect(result.recommended).toBe("dark");
  });

  it("applies a staff override and reports a tone that cannot pass as no scrim", () => {
    const analysis = solveCoverScrim("desktop", "left", uniform("#f4f1ea"));
    expect(scrimSettingFor(analysis, undefined)?.tone).toBe("dark");
    expect(scrimSettingFor(analysis, "light")).toBeNull();
    expect(scrimSettingFor(undefined, "light")).toBeNull();
  });
});
