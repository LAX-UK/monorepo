import { ArtStatusState } from "@/components/art-status-state";
import { ArtEditorialCardGrid } from "@/components/editorial/art-editorial-card";
import { ArtEditorialStatus } from "@/components/editorial/art-editorial-status";
import { ArtMediaImage } from "@/components/media/art-media-image";
import { artServices } from "@/lib/art-services.server";
import { STORIES_TABS, type StoriesTabId } from "@/lib/editorial/editorial-story.vm";
import { composeStoriesIndexPage } from "@/lib/editorial/stories-index-page.composer";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import {
  MarketingAudioPlayer,
  MarketingPageTitle,
  MarketingSplitFeature,
  MarketingSubNav,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

const EMPTY_COPY: Record<StoriesTabId, string> = {
  all: "Stories, films and episodes will appear here when published.",
  artists: "Artist stories and films will appear here when published.",
  podcast: "Podcast episodes will appear here when published.",
  press: "Press coverage will appear here when published.",
};

/**
 * One page body for every stories tab. Tabs are route segments, not a query string, so these
 * pages can sit under a loading boundary without hitting the query-navigation bug described in
 * `query-navigation-routes.test.ts`.
 */
export async function ArtStoriesIndex({ tab }: { tab: StoriesTabId }) {
  const result = await composeStoriesIndexPage(artServices, tab);
  const episode = result.status === "ok" ? result.data.latestEpisode : null;

  return (
    <div className="flex flex-col pb-10 lg:pb-16">
      <MarketingPageTitle
        eyebrow="Art Hub"
        title="All stories"
        subtitle="Conversations, films, episodes and press from the artists and exhibitions behind LAX."
      />
      <div className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-10 pt-2")}>
        {result.status === "disabled" ? null : (
          <MarketingSubNav
            ariaLabel="Story types"
            active={tab}
            items={STORIES_TABS.map(({ id, label, href }) => ({ id, label, href }))}
          />
        )}
        {result.status !== "ok" ? (
          <ArtEditorialStatus
            result={result}
            disabledTitle="Stories coming soon"
            disabledDescription="Editorial programming is not enabled in this environment yet."
            emptyTitle="No stories yet"
            emptyDescription={EMPTY_COPY[tab]}
          />
        ) : result.data.cards.length === 0 && !episode ? (
          <ArtStatusState
            variant="empty"
            title="Nothing published yet"
            description={EMPTY_COPY[tab]}
          />
        ) : (
          <>
            {episode ? (
              <MarketingSplitFeature
                tone="feature"
                mediaSide="left"
                eyebrow="Latest episode"
                title={episode.title}
                body={
                  <div className="flex flex-col gap-6">
                    {episode.description ? <p>{episode.description}</p> : null}
                    <MarketingAudioPlayer
                      src={episode.audioUrl}
                      title={episode.title}
                      durationSeconds={episode.durationSeconds}
                    />
                  </div>
                }
                action={
                  <Button asChild variant="secondaryOutline" size="lg">
                    <Link href={episode.href}>Explore the episode</Link>
                  </Button>
                }
                {...(episode.imageUrl
                  ? {
                      media: (
                        <ArtMediaImage
                          src={episode.imageUrl}
                          alt=""
                          label="Podcast"
                          priority
                          sizes="(min-width: 48rem) 50vw, 100vw"
                          className="absolute inset-0 size-full"
                          imgClassName="object-cover"
                        />
                      ),
                    }
                  : {})}
              />
            ) : null}
            {result.data.cards.length > 0 ? (
              <ArtEditorialCardGrid
                cards={result.data.cards}
                ariaLabel="Stories"
                priorityCount={episode ? 0 : 3}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
