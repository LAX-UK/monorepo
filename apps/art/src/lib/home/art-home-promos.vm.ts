import type { EditorialCardVm } from "@/lib/editorial/editorial-card.vm";

export type ArtHomeGuidePromoVm = {
  title: string;
  body: string;
  cta: { label: string; href: string };
  imageUrl: string | null;
};

/** Guide split promo (Figma home `299:4150`); the first `home_guide` placement image dresses it when set. */
export function buildArtHomeGuidePromoVm(guide: readonly EditorialCardVm[]): ArtHomeGuidePromoVm {
  return {
    title: "Finding your way into art.",
    body: "This guide helps you understand more about art: how to look at it, how to think about it, and how to find the work that speaks to you.",
    cta: { label: "Explore the guide", href: "/collector-hub/101-guide" },
    imageUrl: guide.find((card) => card.imageUrl)?.imageUrl ?? null,
  };
}
