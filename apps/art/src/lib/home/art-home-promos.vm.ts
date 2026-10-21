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

/** Closing call to action (Figma home `299:4579`); the button opens the general enquiry sheet. */
export const ART_HOME_CLOSING_CTA = {
  title: "Take the conversation further",
  body: "Speak with our team for further information on the artists, artworks and exhibitions currently presented by LAX.",
  triggerLabel: "Begin a private enquiry",
} as const;
