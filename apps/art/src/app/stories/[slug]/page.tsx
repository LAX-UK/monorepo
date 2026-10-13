import { ArtEditorialHeader } from "@/components/editorial/art-editorial-header";
import { EditorialBlockRenderer } from "@/components/editorial/editorial-block-renderer";
import { ArtMediaImage } from "@/components/media/art-media-image";
import { ArtJsonLd } from "@/components/seo/art-json-ld";
import { loadArtStorefrontBaseUrl } from "@/env.server";
import { artServices } from "@/lib/art-services.server";
import { composeStoryPage } from "@/lib/editorial/editorial-pages.composer";
import { storyJsonLd } from "@/lib/seo/art-structured-data";
import { notFoundOrUnavailable } from "@/lib/seo/page-status";
import { seoMetadataDescription, seoMetadataTitle } from "@/lib/seo/seo-metadata";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { MarketingVideoPoster } from "@auction/marketing-ui";
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

  const { story, kicker, body } = result.data;
  const film = isSafeEditorialHref(story.videoUrl) && story.videoUrl.startsWith("https://");

  return (
    <article className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-10 py-10")}>
      <ArtJsonLd data={storyJsonLd(story, loadArtStorefrontBaseUrl())} />
      <ArtEditorialHeader
        kicker={kicker}
        title={story.title}
        standfirst={story.standfirst}
        coverUrl={film ? null : story.coverUrl}
      />
      {film && story.videoUrl ? (
        <MarketingVideoPoster
          href={story.videoUrl}
          title={story.title}
          className="max-w-5xl"
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
      <EditorialBlockRenderer body={body} className="max-w-3xl" />
    </article>
  );
}
