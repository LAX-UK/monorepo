import type {
  ArtEditorialStoryDetail,
  ArtEditorialStorySummary,
} from "@/lib/editorial/art-editorial.types";
import { type ArtHubPodcastVm, buildHubPodcast } from "@/lib/editorial/art-hub.vm";
import type { EditorialCardVm } from "@/lib/editorial/editorial-card.vm";
import type { ArtEditorialPageResult } from "@/lib/editorial/editorial-pages.composer";
import {
  type StoriesTabId,
  filterStoriesForTab,
  newestFirst,
  storiesTab,
  storyFeatureCard,
} from "@/lib/editorial/editorial-story.vm";
import type { ArtEditorialPort } from "@/lib/ports";

export type StoriesIndexVm = {
  tab: StoriesTabId;
  cards: EditorialCardVm[];
  /** Podcast tab only: the newest episode with a playable file, shown as the page lead. */
  latestEpisode: ArtHubPodcastVm | null;
};

/**
 * The tab's stories, newest first. Podcast leads with its latest episode, so that episode is
 * left out of the card grid rather than shown twice.
 */
export async function composeStoriesIndexPage(
  services: { editorial: Pick<ArtEditorialPort, "listStories" | "getStory"> },
  tabId: StoriesTabId,
): Promise<ArtEditorialPageResult<StoriesIndexVm>> {
  const result = await services.editorial.listStories(storiesTab(tabId).query);
  if (result.status !== "ok") return result;
  const stories = newestFirst(filterStoriesForTab(tabId, result.data.items));

  let lead: ArtEditorialStorySummary | undefined;
  let latestEpisode: ArtHubPodcastVm | null = null;
  if (tabId === "podcast") {
    lead = stories[0];
    const detail: ArtEditorialStoryDetail | null = lead
      ? await services.editorial
          .getStory(lead.slug)
          .then((r) => (r.status === "ok" ? r.data : null))
      : null;
    latestEpisode = buildHubPodcast(detail);
  }

  const grid = latestEpisode && lead ? stories.filter((story) => story !== lead) : stories;
  return {
    status: "ok",
    data: {
      tab: tabId,
      cards: grid.map((story) => storyFeatureCard(story, "date")),
      latestEpisode,
    },
  };
}
