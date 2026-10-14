import type { EditorialCardVm } from "@/lib/editorial/editorial-card.vm";

export const ART_HOME_HERO_HEADLINE = "Art For a New Generation";
export const ART_HOME_HERO_COPY =
  "Discover original works, emerging artists and distinctive perspectives from around the world, with a new approach to collecting.";
export const ART_HOME_HERO_IMAGE = "/art/home/hero-gallery.webp";

export type ArtHomeHeroVm = {
  kicker: string | null;
  headline: string;
  copy: string;
  cta: { href: string; label: string };
  imageUrl: string;
};

/** Editorial `home_hero` placement wins; the gallery photograph and catalogue CTA are the default. */
export function buildArtHomeHeroVm(placement: EditorialCardVm | null): ArtHomeHeroVm {
  return {
    kicker: placement?.kicker ?? null,
    headline: placement?.headline ?? ART_HOME_HERO_HEADLINE,
    copy: ART_HOME_HERO_COPY,
    cta: placement?.href
      ? { href: placement.href, label: "Discover more" }
      : { href: "/artworks", label: "Discover artworks" },
    imageUrl: placement?.imageUrl ?? ART_HOME_HERO_IMAGE,
  };
}
