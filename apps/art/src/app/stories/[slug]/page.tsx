import { ArtEditorialCardGrid } from "@/components/editorial/art-editorial-card";
import { EditorialBlockRenderer } from "@/components/editorial/editorial-block-renderer";
import { ArtMediaPageTitle } from "@/components/layout/art-media-page-title";
import { ArtSection } from "@/components/layout/art-section";
import { ArtMediaImage } from "@/components/media/art-media-image";
import { ArtJsonLd } from "@/components/seo/art-json-ld";
import { loadArtStorefrontBaseUrl } from "@/env.server";
import { artServices } from "@/lib/art-services.server";
import { composeStoryPage } from "@/lib/editorial/editorial-pages.composer";
import { storyJsonLd } from "@/lib/seo/art-structured-data";
import { notFoundOrUnavailable } from "@/lib/seo/page-status";
import { seoMetadataDescription, seoMetadataTitle } from "@/lib/seo/seo-metadata";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import {
  MarketingAudioPlayer,
  MarketingPageTitle,
  MarketingShareButton,
  MarketingSubNav,
  MarketingVideoPoster,
} from "@auction/marketing-ui";
import { isSafeEditorialHref } from "@auction/shop-contracts";
import { cn } from "@auction/ui";
import type { Metadata } from "next";
import { cache } from "react";

type StoryPageProps = {
  params: Promise<{ slug: string }>;
};

const loadStory = cache((slug: string) => composeStoryPage(artServices, slug));

export async function generateMetadata({ params }: StoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadStory(slug);
  if (result.status !== "ok") notFoundOrUnavailable(result.status, "Story");
  const { story } = result.data;
  const description = seoMetadataDescription(story, story.standfirst);
  return {
    title: seoMetadataTitle(story, story.title),
    ...(description ? { description } : {}),
    alternates: { canonical: `/stories/${encodeURIComponent(story.slug)}` },
    openGraph: {
      type: "article",
      title: story.title,
      ...(description ? { description } : {}),
      ...(story.coverUrl ? { images: [{ url: story.coverUrl }] } : {}),
    },
  };
}

export default async function StoryPage({ params }: StoryPageProps) {
  const { slug } = await params;
  const result = await loadStory(slug);
  if (result.status !== "ok") notFoundOrUnavailable(result.status, "Story");

  const { story, kicker, byline, body, related } = result.data;
  const film = isSafeEditorialHref(story.videoUrl) && story.videoUrl.startsWith("https://");
  const path = `/stories/${encodeURIComponent(story.slug)}`;
  // A film's cover is its video poster below, so the title stays plain rather than repeat it.
  const heroImage = film ? null : story.coverUrl;
  const title = {
    title: story.title,
    eyebrow: kicker,
    subtitle: story.standfirst,
    ...(byline ? { meta: [byline] } : {}),
  };
  const audioUrl =
    isSafeEditorialHref(story.audioUrl) && story.audioUrl.startsWith("https://")
      ? story.audioUrl
      : null;

  return (
    <article className="flex flex-col pb-10 lg:pb-16">
      <ArtJsonLd data={storyJsonLd(story, loadArtStorefrontBaseUrl())} />
      {heroImage ? (
        <ArtMediaPageTitle variant="media" image={{ src: heroImage }} priority {...title} />
      ) : (
        <MarketingPageTitle {...title} />
      )}
      <MarketingSubNav
        mode="anchor"
        sticky
        ariaLabel="Reading"
        items={[]}
        identity={{ title: story.title, imageSrc: story.coverUrl }}
        progressTargetId="story-body"
        actions={<MarketingShareButton url={path} title={story.title} appearance="text" />}
      />
      <div id="story-body" className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-10 pt-10")}>
        {film && story.videoUrl ? (
          <MarketingVideoPoster
            href={story.videoUrl}
            title={story.title}
            className="mx-auto w-full max-w-5xl"
            {...(story.coverUrl
              ? {
                  poster: (
                    <ArtMediaImage
                      src={story.coverUrl}
                      alt=""
                      priority
                      sizes="(min-width: 64rem) 64rem, 100vw"
                      className="absolute inset-0 size-full"
                      imgClassName="object-cover"
                    />
                  ),
                }
              : {})}
          />
        ) : null}
        {audioUrl ? (
          <MarketingAudioPlayer
            src={audioUrl}
            title={story.title}
            durationSeconds={story.durationSeconds ?? null}
            className="mx-auto max-w-[53.75rem]"
          />
        ) : null}
        <EditorialBlockRenderer body={body} wideMedia className="mx-auto w-full max-w-[53.75rem]" />
        {related ? (
          <ArtSection id="story-related" title={related.heading}>
            <ArtEditorialCardGrid cards={related.cards} ariaLabel={related.heading} />
          </ArtSection>
        ) : null}
      </div>
    </article>
  );
}
