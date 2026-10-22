import type {
  ArtEditorialExhibitionSummary,
  ArtEditorialStorySummary,
  ArtStoryListFilter,
} from "@/lib/editorial/art-editorial.types";
import { type EditorialCardVm, exhibitionCard, storyCard } from "@/lib/editorial/editorial-card.vm";
import { exhibitionHasEnded } from "@/lib/editorial/editorial-page-title.vm";
import {
  EDITORIAL_STORY_CATEGORY_LABELS,
  EDITORIAL_STORY_TAB_LABELS,
  type EditorialStoryCategory,
  type EditorialStoryTab,
  defaultEditorialStoryCategory,
  editorialStoryTab,
} from "@auction/shop-contracts";

type StoryFields = Pick<ArtEditorialStorySummary, "kind" | "category">;

const STORY_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** “21 Oct 2026”; null when unpublished or unparseable. */
export function formatStoryDate(publishedAt: string | null | undefined): string | null {
  if (!publishedAt) return null;
  const date = new Date(publishedAt);
  return Number.isNaN(date.getTime()) ? null : STORY_DATE.format(date);
}

export function storyCategory(story: StoryFields): EditorialStoryCategory {
  return story.category ?? defaultEditorialStoryCategory(story.kind);
}

export function storyCategoryLabel(story: StoryFields): string {
  return EDITORIAL_STORY_CATEGORY_LABELS[storyCategory(story)];
}

/** “4 MIN READ”; null when the length is unknown. */
export function readMinutesLabel(readMinutes: number | null | undefined): string | null {
  return readMinutes && readMinutes > 0 ? `${readMinutes} MIN READ` : null;
}

/** “By Clara Hutchins · 21 Oct 2026”; the date alone without an author, nothing without either. */
export function storyByline(story: {
  authorName?: string | null | undefined;
  publishedAt?: string | null | undefined;
}): string | null {
  const author = story.authorName?.trim();
  const parts = [author ? `By ${author}` : null, formatStoryDate(story.publishedAt)];
  const line = parts.filter((part): part is string => Boolean(part)).join(" · ");
  return line || null;
}

type StoryCardKicker = "read" | "date";

/** Card for the hub rail (“CATEGORY | n MIN READ”) and the index grid (“CATEGORY | DATE”). */
export function storyFeatureCard(
  story: ArtEditorialStorySummary,
  kicker: StoryCardKicker,
): EditorialCardVm {
  const detail =
    kicker === "read" ? readMinutesLabel(story.readMinutes) : formatStoryDate(story.publishedAt);
  return {
    ...storyCard(story),
    kicker: storyCategoryLabel(story),
    kickerDetail: detail,
    meta: null,
  };
}

export type StoriesTabId = "all" | "artists" | "podcast" | "press";

export type StoriesTab = {
  id: StoriesTabId;
  label: string;
  href: string;
  /** API filter; a tab without one reads every story and narrows it by `tabOfStory`. */
  query: ArtStoryListFilter;
};

/** Tabs are route segments, so switching never rewrites a query string. */
const ALL_TAB: StoriesTab = { id: "all", label: "All", href: "/stories", query: {} };

export const STORIES_TABS: readonly StoriesTab[] = [
  ALL_TAB,
  {
    id: "artists",
    label: EDITORIAL_STORY_TAB_LABELS.stories_and_films,
    href: "/stories/artists",
    query: {},
  },
  {
    id: "podcast",
    label: EDITORIAL_STORY_TAB_LABELS.podcast,
    href: "/stories/podcast",
    query: { kind: "podcast" },
  },
  {
    id: "press",
    label: EDITORIAL_STORY_TAB_LABELS.press,
    href: "/stories/press",
    query: { kind: "press" },
  },
];

const TAB_OF_EDITORIAL_TAB: Record<EditorialStoryTab, StoriesTabId> = {
  stories_and_films: "artists",
  podcast: "podcast",
  press: "press",
};

/** The tab a story belongs to: its format first, then the category's tab. */
export function tabOfStory(story: StoryFields): StoriesTabId {
  if (story.kind === "podcast") return "podcast";
  if (story.kind === "press") return "press";
  return TAB_OF_EDITORIAL_TAB[editorialStoryTab(storyCategory(story))];
}

export function storiesTab(id: StoriesTabId): StoriesTab {
  return STORIES_TABS.find((tab) => tab.id === id) ?? ALL_TAB;
}

export function filterStoriesForTab<T extends StoryFields>(
  tab: StoriesTabId,
  stories: readonly T[],
): T[] {
  return tab === "all" ? [...stories] : stories.filter((story) => tabOfStory(story) === tab);
}

/** Newest first; undated stories last. */
export function newestFirst<T extends { publishedAt?: string | null | undefined }>(
  stories: readonly T[],
): T[] {
  const time = (story: T) => (story.publishedAt ? Date.parse(story.publishedAt) || 0 : 0);
  return [...stories].sort((a, b) => time(b) - time(a));
}

const RELATED_LIMIT = 3;

export type RelatedContentVm =
  | { kind: "exhibitions"; heading: "Related exhibitions"; cards: EditorialCardVm[] }
  | { kind: "stories"; heading: "Related stories"; cards: EditorialCardVm[] };

/** Exhibitions still on or yet to open; one with no end date counts as open. */
export function currentOrUpcomingExhibitions<
  T extends Pick<ArtEditorialExhibitionSummary, "endsOn">,
>(exhibitions: readonly T[], now: Date): T[] {
  return exhibitions.filter((exhibition) => !exhibitionHasEnded(exhibition.endsOn, now));
}

/**
 * What an article offers next (Figma `687:17324`): a current or upcoming exhibition it relates to
 * wins; otherwise stories sharing its series or category, in the order the groups are given. LAX.bid
 * auctions sit between the two in the design but have no data yet.
 */
export function selectRelatedContent(input: {
  exhibitions: readonly ArtEditorialExhibitionSummary[];
  storyGroups: readonly (readonly ArtEditorialStorySummary[])[];
  currentSlug: string;
  now: Date;
}): RelatedContentVm | null {
  const open = currentOrUpcomingExhibitions(input.exhibitions, input.now);
  if (open.length > 0) {
    return {
      kind: "exhibitions",
      heading: "Related exhibitions",
      cards: open.slice(0, RELATED_LIMIT).map(exhibitionCard),
    };
  }
  for (const group of input.storyGroups) {
    const others = group.filter((story) => story.slug !== input.currentSlug);
    if (others.length > 0) {
      return {
        kind: "stories",
        heading: "Related stories",
        cards: others.slice(0, RELATED_LIMIT).map((story) => storyFeatureCard(story, "date")),
      };
    }
  }
  return null;
}
