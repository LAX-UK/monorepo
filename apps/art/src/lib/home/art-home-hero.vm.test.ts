import { describe, expect, it } from "vitest";
import {
  ART_HOME_HERO_HEADLINE,
  ART_HOME_HERO_IMAGE,
  buildArtHomeHeroVm,
} from "./art-home-hero.vm";

describe("buildArtHomeHeroVm", () => {
  it("defaults to the gallery photograph and the catalogue CTA", () => {
    expect(buildArtHomeHeroVm(null)).toMatchObject({
      kicker: null,
      headline: ART_HOME_HERO_HEADLINE,
      imageUrl: ART_HOME_HERO_IMAGE,
      cta: { href: "/artworks", label: "Discover artworks" },
    });
  });

  it("uses the editorial placement's headline, kicker, image and link", () => {
    const vm = buildArtHomeHeroVm({
      key: "p1",
      href: "/exhibitions/summer-show",
      headline: "Summer show",
      kicker: "Now on",
      meta: null,
      imageUrl: "https://cdn.test/hero.jpg",
    });
    expect(vm).toMatchObject({
      kicker: "Now on",
      headline: "Summer show",
      imageUrl: "https://cdn.test/hero.jpg",
      cta: { href: "/exhibitions/summer-show", label: "Discover more" },
    });
  });

  it("keeps the gallery photograph when the placement has no image", () => {
    const vm = buildArtHomeHeroVm({
      key: "p1",
      href: null,
      headline: "Summer show",
      kicker: null,
      meta: null,
      imageUrl: null,
    });
    expect(vm.imageUrl).toBe(ART_HOME_HERO_IMAGE);
    expect(vm.cta.href).toBe("/artworks");
  });
});
