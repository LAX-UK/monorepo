import {
  BAND_STOPS,
  COVER_BOXES,
  RADIAL_STOPS,
  SCRIM_COLOUR,
  TEXT_STYLE,
  contrastRatio,
  cropKeepsArea,
  lineScrimAlpha,
} from "@auction/domain/cover";
import { describe, expect, it } from "vitest";
import { cropToFrame, planCoverBoxes, resolveCoverCrop, slotForBox } from "./cover-crop.js";
import { coverSettles } from "./cover-motion.js";
import {
  bandStops,
  coverTextVars,
  creditBandBackground,
  radialStops,
  scrimBackground,
} from "./cover-scrim.js";
import {
  activeCoverMedia,
  activeCoverMediaIndex,
  slidePosition,
  stepSlide,
} from "./cover-sources.js";
import { coverTitleClass, coverTitleScale } from "./cover-type-scale.js";
import type { CoverPhotoMedia, CoverPhotoSlot, CoverPlateMedia } from "./cover-types.js";

const slot = (over: Partial<CoverPhotoSlot> = {}): CoverPhotoSlot => ({
  src: "/a.jpg",
  width: 3000,
  height: 2000,
  focal: { x: 0.5, y: 0.5 },
  zoom: 1,
  ...over,
});

const photo = (over: Partial<CoverPhotoMedia> = {}): CoverPhotoMedia => ({
  kind: "photo",
  alt: "A work",
  side: "left",
  slots: { default: slot() },
  scrim: { desktop: { tone: "light", strength: 0.6, creditBand: 0.5 } },
  colour: "#334455",
  ...over,
});

const plate: CoverPlateMedia = {
  kind: "plate",
  alt: "A work",
  side: "left",
  src: "/p.jpg",
  width: 1200,
  height: 1500,
  field: "#1c2a35",
  tone: "light",
};

describe("resolveCoverCrop", () => {
  it("puts the focal point on the far third from the type", () => {
    const left = resolveCoverCrop({
      slot: slot({ focal: { x: 0.5, y: 0.5 }, zoom: 1.5 }),
      box: "desktop",
      side: "left",
    });
    const right = resolveCoverCrop({
      slot: slot({ focal: { x: 0.5, y: 0.5 }, zoom: 1.5 }),
      box: "desktop",
      side: "right",
    });
    // Subject at 68% of the box when the text is on the left, 32% when it is on the right.
    const place = (c: { crop: { x: number; width: number } }) => (0.5 - c.crop.x) / c.crop.width;
    expect(place(left)).toBeCloseTo(0.68, 2);
    expect(place(right)).toBeCloseTo(0.32, 2);
  });

  it("centres the focal point on the phone, where no text sits on the picture", () => {
    const phone = resolveCoverCrop({ slot: slot(), box: "phone", side: "left" });
    expect((0.5 - phone.crop.x) / phone.crop.width).toBeCloseTo(0.5, 2);
  });

  it("zooms in for a detail and shows a smaller part of the picture", () => {
    const whole = resolveCoverCrop({ slot: slot(), box: "desktop", side: "left" });
    const detail = resolveCoverCrop({ slot: slot({ zoom: 2 }), box: "desktop", side: "left" });
    expect(detail.crop.width).toBeCloseTo(whole.crop.width / 2, 5);
  });

  it("backs off the zoom to keep the keep-in-frame area visible", () => {
    const keep = { x: 0.05, y: 0.25, width: 0.5, height: 0.5 };
    const result = resolveCoverCrop({
      slot: slot({ zoom: 2.5, focal: { x: 0.3, y: 0.5 }, keep }),
      box: "desktop",
      side: "left",
    });
    expect(result.keepsArea).toBe(true);
    expect(result.zoom).toBeLessThan(2.5);
    expect(cropKeepsArea(result.crop, keep)).toBe(true);
  });

  it("centres on the area when only that keeps it, and reports a cut area honestly", () => {
    const tall = slot({ width: 2000, height: 3000 });
    const fits = { x: 0.1, y: 0.4, width: 0.8, height: 0.15 };
    const centred = resolveCoverCrop({
      slot: { ...tall, focal: { x: 0.1, y: 0.9 }, keep: fits },
      box: "desktop",
      side: "left",
    });
    expect(centred.keepsArea).toBe(true);
    const tooTall = { x: 0.1, y: 0.05, width: 0.8, height: 0.9 };
    const cut = resolveCoverCrop({
      slot: { ...tall, keep: tooTall },
      box: "desktop",
      side: "left",
    });
    expect(cut.keepsArea).toBe(false);
  });

  it("always fills the box", () => {
    for (const box of ["phone", "desktop", "wide"] as const) {
      const { crop } = resolveCoverCrop({
        slot: slot({ focal: { x: 0.99, y: 0.01 }, zoom: 1.7 }),
        box,
        side: "right",
      });
      expect(crop.x).toBeGreaterThanOrEqual(0);
      expect(crop.y).toBeGreaterThanOrEqual(0);
      expect(crop.x + crop.width).toBeLessThanOrEqual(1 + 1e-9);
      expect(crop.y + crop.height).toBeLessThanOrEqual(1 + 1e-9);
      expect(COVER_BOXES[box].width).toBeGreaterThan(0);
    }
  });
});

describe("slotForBox and planCoverBoxes", () => {
  const wide = slot({ src: "/wide.jpg", width: 3840, height: 1440 });
  const phone = slot({ src: "/phone.jpg", width: 1600, height: 1600 });

  it("uses the wide and phone slots when they are large enough", () => {
    const slots = { default: slot(), wide, phone };
    expect(slotForBox(slots, "wide").src).toBe("/wide.jpg");
    expect(slotForBox(slots, "phone").src).toBe("/phone.jpg");
    expect(slotForBox(slots, "desktop").src).toBe("/a.jpg");
  });

  it("falls back to a crop of the default slot when a slot is undersized", () => {
    const slots = {
      default: slot(),
      wide: slot({ src: "/w.jpg", width: 2000, height: 800 }),
      phone: slot({ src: "/p.jpg", width: 800, height: 800 }),
    };
    expect(slotForBox(slots, "wide").src).toBe("/a.jpg");
    expect(slotForBox(slots, "phone").src).toBe("/a.jpg");
  });

  it("plans a frame for every box", () => {
    const plan = planCoverBoxes(photo());
    expect(Object.keys(plan).sort()).toEqual(["desktop", "phone", "wide"]);
    expect(plan.desktop.frame.width).toBeGreaterThanOrEqual(100);
  });

  it("turns a crop into a frame that shows only the crop", () => {
    const frame = cropToFrame({ x: 0.25, y: 0, width: 0.5, height: 1 });
    expect(frame).toEqual({ width: 200, height: 100, left: -50, top: 0 });
  });
});

describe("scrim painting matches the domain solver", () => {
  it("scales the solver's eased stops by the stored strength", () => {
    const stops = radialStops(0.6);
    expect(stops.map((s) => s.at)).toEqual(RADIAL_STOPS.map(([at]) => at));
    expect(stops.map((s) => s.alpha)).toEqual(
      RADIAL_STOPS.map(([, share]) => Math.round(0.6 * share * 1000) / 1000),
    );
    expect(RADIAL_STOPS.map(([, s]) => s)).toEqual([1, 0.97, 0.86, 0.68, 0.42, 0.16, 0]);
  });

  it("paints an ellipse of 95% by 125% from the text corner", () => {
    const css = scrimBackground({ side: "left", tone: "light", strength: 0.6 });
    expect(css).toContain("ellipse 95% 125% at left bottom");
    expect(css).toContain("rgba(10, 11, 11, 0.6) 0%");
    expect(css.endsWith("rgba(10, 11, 11, 0) 100%)")).toBe(true);
    expect(scrimBackground({ side: "right", tone: "dark", strength: 0.5 })).toContain(
      "at right bottom",
    );
    expect(SCRIM_COLOUR.dark).toEqual([246, 244, 238]);
  });

  it("paints the credit band from the solver's pixel stops", () => {
    expect(bandStops(0.5).map((s) => s.at)).toEqual(BAND_STOPS.map(([at]) => at));
    const css = creditBandBackground({ tone: "light", creditBand: 0.5 });
    expect(css).toContain("linear-gradient(to top");
    expect(css).toContain("112px");
  });

  it("reproduces the solver's opacity at a text line from the painted stops", () => {
    // Interpolate the painted radial stops at the title zone and compare with lineScrimAlpha.
    const strength = 0.7;
    const painted = radialStops(strength);
    const at = (percent: number) => {
      for (let i = 1; i < painted.length; i++) {
        const a = painted[i - 1];
        const b = painted[i];
        if (a && b && percent <= b.at) {
          return a.alpha + ((b.alpha - a.alpha) * (percent - a.at)) / (b.at - a.at);
        }
      }
      return 0;
    };
    const solver = lineScrimAlpha("desktop", "eyebrow", "left", strength, 0.5);
    // The eyebrow sits off the credit band, so the solver value is the radial alone.
    const x = 40 + 520;
    const y = COVER_BOXES.desktop.height - 290 - 20;
    const distance = Math.hypot(x / (0.95 * 1440), (640 - y) / (1.25 * 640));
    expect(at(distance * 100)).toBeCloseTo(solver, 2);
  });

  it("exposes the solver's text colours as variables", () => {
    const vars = coverTextVars("light");
    expect(vars["--cover-title"]).toBe("rgba(255, 255, 255, 1)");
    expect(vars["--cover-credit"]).toBe("rgba(255, 255, 255, 0.82)");
    expect(coverTextVars("dark")["--cover-title"]).toBe(
      `rgba(${TEXT_STYLE.dark.title.colour.join(", ")}, 1)`,
    );
  });

  it("keeps the dark type colours passing on the paper scrim", () => {
    expect(contrastRatio(TEXT_STYLE.dark.title.colour, SCRIM_COLOUR.dark)).toBeGreaterThan(7);
  });
});

describe("coverTitleScale", () => {
  it("steps 56/60, 44/52, 36/44 on desktop by length", () => {
    expect(coverTitleScale("Post-War and Contemporary").desktop).toMatchObject({
      size: 56,
      line: 60,
    });
    expect(coverTitleScale("Post-War and Contemporary Art, Evening Sale").desktop).toMatchObject({
      size: 44,
      line: 52,
    });
    expect(coverTitleScale("A".repeat(60)).desktop).toMatchObject({ size: 36, line: 44 });
  });

  it("uses 30/36 on a phone, and 26/32 for a very long title", () => {
    expect(coverTitleScale("Estuary").phone).toMatchObject({ size: 30, line: 36 });
    expect(coverTitleScale("A".repeat(50)).phone).toMatchObject({ size: 26, line: 32 });
  });

  it("turns the steps into static classes", () => {
    expect(coverTitleClass("Estuary")).toBe(
      "text-[30px] leading-[36px] tracking-[-0.015em] md:text-[56px] md:leading-[60px] md:tracking-[-0.02em]",
    );
  });
});

describe("coverSettles", () => {
  const sharp = photo({ slots: { default: slot({ width: 3200 }) } });
  const soft = photo({ slots: { default: slot({ width: 2400 }) } });
  it("settles plates, type covers and pictures under 2880px", () => {
    expect(coverSettles(plate)).toBe(true);
    expect(coverSettles(null)).toBe(true);
    expect(coverSettles(soft)).toBe(true);
  });
  it("keeps a sharp picture still, and counts the zoom", () => {
    expect(coverSettles(sharp)).toBe(false);
    const zoomed = photo({ slots: { default: slot({ width: 3200, zoom: 1.5 }) } });
    expect(coverSettles(zoomed)).toBe(true);
  });
});

describe("sources and pinned sales", () => {
  it("moves silently to the next source when one fails, then to type only", () => {
    const media = [photo(), plate];
    expect(activeCoverMedia(media, new Set())?.kind).toBe("photo");
    expect(activeCoverMedia(media, new Set([0]))?.kind).toBe("plate");
    expect(activeCoverMedia(media, new Set([0, 1]))).toBeNull();
    expect(activeCoverMediaIndex(media, new Set([0]))).toBe(1);
  });

  it("skips a photograph that has no scrim for the desktop", () => {
    const unusable = photo({ scrim: { desktop: null } });
    expect(activeCoverMedia([unusable, plate], new Set())?.kind).toBe("plate");
    expect(activeCoverMedia([unusable], new Set())).toBeNull();
  });

  it("steps previous and next around the ends and words the position", () => {
    expect(stepSlide(0, 3, -1)).toBe(2);
    expect(stepSlide(2, 3, 1)).toBe(0);
    expect(stepSlide(1, 3, 1)).toBe(2);
    expect(slidePosition(0, 3)).toBe("1 of 3");
  });
});
