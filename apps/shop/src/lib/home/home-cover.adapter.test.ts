import type { CoverPhotoMedia } from "@auction/marketing-ui";
import { describe, expect, it } from "vitest";
import { chooseShopHeroCover, plateFromRelease, toShopCoverSlide } from "./home-cover.adapter";
import type { HomeHeroVm } from "./home-page.vm";

const release = {
  href: "/artworks/vessel-study",
  imageUrl: "https://cdn.test/vessel.jpg",
  imageAlt: "Vessel Study",
  line: "Now released: Vessel Study, 2014 · £120",
};

const hero = (over: Partial<HomeHeroVm> = {}): HomeHeroVm => ({
  eyebrow: "New release · 28 Oct 2026",
  title: "Limited-edition prints",
  lead: "Editions by Flora Powers, from £42. Prices include VAT.",
  primary: { label: "Browse editions", href: "/artworks" },
  link: { label: "Browse all editions", href: "/artworks" },
  release,
  browseRows: [],
  emptyAction: null,
  ...over,
});

const plate = { width: 800, height: 1000, field: "#eee3df", fieldDark: "#2a2523" };

describe("toShopCoverSlide", () => {
  it("leads with the release as a plate on a pale field, credited to it", () => {
    const slide = toShopCoverSlide(hero(), { plate });
    expect(slide.time).toBe("New release · 28 Oct 2026");
    expect(slide.fact).toBe("Editions by Flora Powers, from £42. Prices include VAT.");
    expect(slide.primary).toEqual({ label: "Browse editions", href: "/artworks" });
    expect(slide.link).toEqual({ label: "Browse all editions", href: "/artworks" });
    expect(slide.credit).toEqual({ text: release.line, href: release.href });
    expect(slide.media).toEqual([
      expect.objectContaining({
        kind: "plate",
        field: "#eee3df",
        fieldDark: "#2a2523",
        tone: "dark",
      }),
    ]);
  });

  it("is type only without a photograph, and carries no credit", () => {
    const slide = toShopCoverSlide(hero(), { plate: null });
    expect(slide.media).toEqual([]);
    expect(slide.credit).toBeUndefined();
  });

  it("is type only when there is no release", () => {
    const slide = toShopCoverSlide(hero({ release: null, link: null }), { plate });
    expect(slide.media).toEqual([]);
    expect(slide.link).toBeUndefined();
  });

  it("uses the empty action when nothing is on sale", () => {
    const slide = toShopCoverSlide(
      hero({
        primary: null,
        release: null,
        emptyAction: { label: "Visit lax.art", href: "https://lax.art" },
      }),
    );
    expect(slide.primary).toEqual({ label: "Visit lax.art", href: "https://lax.art" });
  });

  it("leaves out an eyebrow the hero does not have", () => {
    expect("time" in toShopCoverSlide(hero({ eyebrow: null }))).toBe(false);
  });

  it("shows a neutral type cover when the catalogue failed or offers no way on", () => {
    for (const slide of [
      toShopCoverSlide(hero(), { plate, catalogueFailed: true }),
      toShopCoverSlide(hero({ primary: null, emptyAction: null })),
    ]) {
      expect(slide.media).toEqual([]);
      expect(slide.badge).toBeUndefined();
      expect(slide.title).toBe("The editions can’t be shown right now");
    }
  });
});

describe("plateFromRelease", () => {
  it("needs both the release and its measured plate", () => {
    expect(plateFromRelease(null, plate)).toBeNull();
    expect(plateFromRelease(release, null)).toBeNull();
    expect(plateFromRelease(release, plate)?.src).toBe(release.imageUrl);
  });
});

const staffCover = (over: Partial<CoverPhotoMedia> = {}): CoverPhotoMedia => ({
  kind: "photo",
  alt: "The studio wall",
  side: "left",
  colour: "#222222",
  slots: {
    default: {
      src: "https://cdn.test/cover.jpg",
      width: 3200,
      height: 1800,
      focal: { x: 0.7, y: 0.4 },
      zoom: 1,
    },
  },
  scrim: { desktop: { tone: "light", strength: 0.6, creditBand: 0.3 } as never },
  ...over,
});

describe("hero cover choice", () => {
  const plateMedia = plateFromRelease(release, plate);

  it("uses the staff-chosen picture when there is one", () => {
    expect(chooseShopHeroCover({ staffCover: staffCover(), plate: plateMedia })).toBe(
      "staff-photo",
    );
  });

  it("falls back to the newest edition's plate without a staff picture", () => {
    expect(chooseShopHeroCover({ staffCover: null, plate: plateMedia })).toBe("release-plate");
    expect(chooseShopHeroCover({ plate: plateMedia })).toBe("release-plate");
  });

  it("does not use a staff picture that cannot carry the type (no measured scrim)", () => {
    const unmeasured = staffCover({ scrim: {} });
    expect(chooseShopHeroCover({ staffCover: unmeasured, plate: plateMedia })).toBe(
      "release-plate",
    );
    expect(chooseShopHeroCover({ staffCover: unmeasured, plate: null })).toBe("type");
  });

  it("is type only when there is no picture at all", () => {
    expect(chooseShopHeroCover({ plate: null })).toBe("type");
  });

  it("puts the staff picture first and keeps the plate behind it for a failed load", () => {
    const slide = toShopCoverSlide(hero(), { plate, staffCover: staffCover() });
    expect(slide.media.map((m) => m.kind)).toEqual(["photo", "plate"]);
    expect(slide.credit).toBeUndefined();
  });

  it("credits the release only while its plate leads", () => {
    const slide = toShopCoverSlide(hero(), { plate });
    expect(slide.media.map((m) => m.kind)).toEqual(["plate"]);
    expect(slide.credit?.href).toBe(release.href);
  });
});
