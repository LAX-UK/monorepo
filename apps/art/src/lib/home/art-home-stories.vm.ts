import type {
  ArtEditorialPlacement,
  ArtEditorialStorySummary,
} from "@/lib/editorial/art-editorial.types";
import {
  type EditorialCardVm,
  placementHref,
  storyKindLabel,
} from "@/lib/editorial/editorial-card.vm";
import { storyCategory } from "@/lib/editorial/editorial-story.vm";

export const HOME_STORIES_LIMIT = 3;

/** “Story”, “Interview”, “Film”…: the format a reader recognises, not the editor's category. */
export function homeStoryKindLabel(
  story: Pick<ArtEditorialStorySummary, "kind" | "category">,
): string {
  const category = storyCategory(story);
  if (category === "artist_interview" || category === "artist_conversation") return "Interview";
  return storyKindLabel(story.kind);
}

/** “4 min read”; null when the length is unknown. */
export function homeReadingTime(readMinutes: number | null | undefined): string | null {
  return readMinutes && readMinutes > 0 ? `${readMinutes} min read` : null;
}

function trimmed(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function summaryCard(
  story: ArtEditorialStorySummary,
  placement: ArtEditorialPlacement | null,
  imageUrl: string,
): EditorialCardVm {
  return {
    key: placement ? `${placement.slot}-${placement.position}` : story.slug,
    href: `/stories/${encodeURIComponent(story.slug)}`,
    headline: trimmed(placement?.headline) ?? story.title,
    kicker: homeStoryKindLabel(story),
    kickerDetail: homeReadingTime(story.readMinutes),
    meta: null,
    imageUrl,
  };
}

/**
 * Cards for the Featured stories rail. Every card has a cover image: a story with none (an old
 * story published before covers were required) is left out until it gets one, and the list pages
 * still show it. Curated `home_stories` placements lead; without any, featured stories do.
 */
export function buildHomeStoryCards({
  placements,
  stories,
  limit = HOME_STORIES_LIMIT,
}: {
  placements: readonly ArtEditorialPlacement[];
  stories: readonly ArtEditorialStorySummary[];
  limit?: number;
}): EditorialCardVm[] {
  const bySlug = new Map(stories.map((story) => [story.slug, story]));
  const curated = placements
    .filter((placement) => placement.slot === "home_stories")
    .sort((a, b) => a.position - b.position);

  const cards: EditorialCardVm[] =
    curated.length > 0
      ? curated.flatMap((placement): EditorialCardVm[] => {
          const story =
            placement.refKind === "story" && placement.refSlug
              ? (bySlug.get(placement.refSlug) ?? null)
              : null;
          const imageUrl = trimmed(placement.mediaUrl) ?? trimmed(story?.coverUrl);
          if (!imageUrl) return [];
          if (story) return [summaryCard(story, placement, imageUrl)];
          const headline = trimmed(placement.headline);
          if (!headline) return [];
          return [
            {
              key: `${placement.slot}-${placement.position}`,
              href: placementHref(placement),
              headline,
              kicker: "Story",
              meta: null,
              imageUrl,
            },
          ];
        })
      : stories.flatMap((story): EditorialCardVm[] => {
          const imageUrl = trimmed(story.coverUrl);
          return story.featured && imageUrl ? [summaryCard(story, null, imageUrl)] : [];
        });

  const seen = new Set<string>();
  return cards
    .filter((card) => {
      if (!card.href) return true;
      if (seen.has(card.href)) return false;
      seen.add(card.href);
      return true;
    })
    .slice(0, limit);
}
