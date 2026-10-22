import type {
  ArtEditorialPlacement,
  ArtEditorialStorySummary,
} from "@/lib/editorial/art-editorial.types";
import { type EditorialCardVm, placementHref, storyCard } from "@/lib/editorial/editorial-card.vm";

export type HubFeatureCardVm = {
  key: string;
  href: string | null;
  title: string;
  body: string | null;
  /** Null lets the card use its default "Learn more". */
  ctaLabel: string | null;
  imageUrl: string | null;
};

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** `collector_hub_card` placements in position order; untitled ones are skipped. */
export function hubFeatureCards(placements: readonly ArtEditorialPlacement[]): HubFeatureCardVm[] {
  return placements
    .filter((placement) => placement.slot === "collector_hub_card")
    .sort((a, b) => a.position - b.position)
    .flatMap((placement) => {
      const title = clean(placement.headline);
      if (!title) return [];
      return [
        {
          key: `${placement.slot}-${placement.position}`,
          href: placementHref(placement),
          title,
          body: clean(placement.body),
          ctaLabel: clean(placement.ctaLabel),
          imageUrl: placement.mediaUrl,
        },
      ];
    });
}

/** Guide index card: "LAX GUIDE | n MIN READ" over the title (Figma `782:11834`). */
export function guideCard(story: ArtEditorialStorySummary): EditorialCardVm {
  const minutes = story.readMinutes;
  return {
    ...storyCard(story),
    kicker: "LAX Guide",
    kickerDetail: minutes && minutes > 0 ? `${minutes} min read` : null,
    meta: null,
  };
}
