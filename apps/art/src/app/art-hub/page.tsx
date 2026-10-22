import { ArtArtistCard } from "@/components/catalogue/art-artist-grid";
import { ArtEditorialCard } from "@/components/editorial/art-editorial-card";
import { ArtEditorialStatus } from "@/components/editorial/art-editorial-status";
import { ArtHubPressBand } from "@/components/editorial/art-hub-press-band";
import { ArtHomeEcosystemBand } from "@/components/home/art-home-ecosystem-band";
import { ArtRail, ArtRailItem } from "@/components/layout/art-rail";
import { ArtSection } from "@/components/layout/art-section";
import { ArtMediaImage } from "@/components/media/art-media-image";
import { artServices } from "@/lib/art-services.server";
import {
  type ArtHubPageVm,
  type ArtHubSectionId,
  composeArtHubPage,
} from "@/lib/editorial/art-hub-page.composer";
import { ART_HUB_COLLECTING, ART_HUB_HEADINGS, ART_HUB_HERO } from "@/lib/editorial/art-hub.vm";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import {
  MarketingAudioPlayer,
  MarketingLinkList,
  MarketingReveal,
  MarketingSplitFeature,
  MarketingVideoPoster,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Art Hub | LAX Art",
  description:
    "Stories, conversations and films from the artists, exhibitions and people behind the London Art Exchange.",
  alternates: { canonical: "/art-hub" },
};

const OUTLINE_ON_PANEL =
  "min-h-11 border-current bg-transparent font-label text-on-surface-feature hover:bg-surface-container-low/40";

function Shell({ children }: { children: ReactNode }) {
  return <div className={MARKETING_PAGE_SHELL}>{children}</div>;
}

function panelImage(src: string, label: string) {
  return (
    <ArtMediaImage
      src={src}
      alt=""
      label={label}
      sizes="(min-width: 48rem) 50vw, 100vw"
      className="absolute inset-0 size-full"
      imgClassName="object-cover"
    />
  );
}

function HubSection({ id, vm }: { id: ArtHubSectionId; vm: ArtHubPageVm }) {
  switch (id) {
    case "hero":
      return (
        <MarketingSplitFeature
          tone="plain"
          headingLevel="h1"
          mediaSide="right"
          eyebrow={ART_HUB_HERO.eyebrow}
          title={ART_HUB_HERO.title}
          body={
            <div className="flex flex-col gap-8">
              <p>{ART_HUB_HERO.body}</p>
              <MarketingLinkList
                ariaLabel={ART_HUB_HERO.linksLabel}
                items={ART_HUB_HERO.links}
                className="max-w-sm"
              />
            </div>
          }
          {...(vm.heroImageUrl ? { media: panelImage(vm.heroImageUrl, "Art Hub") } : {})}
        />
      );
    case "now-on":
      return (
        <Shell>
          <ArtSection
            id="art-hub-now-on"
            title={ART_HUB_HEADINGS.nowOn}
            subtitle={ART_HUB_HEADINGS.nowOnSubtitle}
            viewAllHref="/exhibitions"
            viewAllSrLabel="exhibitions"
          >
            <ArtRail id="art-hub-now-on-rail" label={ART_HUB_HEADINGS.nowOn}>
              {vm.nowOn.map((card, index) => (
                <ArtRailItem key={card.key} size="feature">
                  <ArtEditorialCard card={card} priority={index === 0} />
                </ArtRailItem>
              ))}
            </ArtRail>
          </ArtSection>
        </Shell>
      );
    case "stories":
      return (
        <Shell>
          <ArtSection
            id="art-hub-stories"
            title={ART_HUB_HEADINGS.stories}
            viewAllHref="/stories"
            viewAllSrLabel="stories"
          >
            <ArtRail id="art-hub-stories-rail" label={ART_HUB_HEADINGS.stories}>
              {vm.stories.map((card) => (
                <ArtRailItem key={card.key} size="feature">
                  <ArtEditorialCard card={card} />
                </ArtRailItem>
              ))}
            </ArtRail>
          </ArtSection>
        </Shell>
      );
    case "spotlight":
      return (
        <Shell>
          <ArtSection
            id="art-hub-spotlight"
            title={ART_HUB_HEADINGS.spotlight}
            viewAllHref="/artists"
            viewAllSrLabel="artists"
          >
            <ul
              className="grid max-w-[56rem] gap-x-6 gap-y-10 sm:grid-cols-2"
              aria-label="Featured artists"
            >
              {vm.artists.map((card) => (
                <li key={card.slug}>
                  <ArtArtistCard card={card} favoriteAuth={vm.favoriteAuth} />
                </li>
              ))}
            </ul>
          </ArtSection>
        </Shell>
      );
    case "podcast": {
      const { podcast } = vm;
      if (!podcast) return null;
      return (
        <MarketingSplitFeature
          tone="feature"
          mediaSide="left"
          eyebrow="LAX's Podcast"
          title={podcast.title}
          body={
            <div className="flex flex-col gap-6">
              {podcast.description ? <p>{podcast.description}</p> : null}
              <MarketingAudioPlayer
                src={podcast.audioUrl}
                title={podcast.title}
                durationSeconds={podcast.durationSeconds}
              />
            </div>
          }
          action={
            <Button asChild variant="outline" size="lg" className={OUTLINE_ON_PANEL}>
              <Link href={podcast.href}>Explore the episode</Link>
            </Button>
          }
          {...(podcast.imageUrl ? { media: panelImage(podcast.imageUrl, "Podcast") } : {})}
        />
      );
    }
    case "films": {
      const { film } = vm;
      if (!film) return null;
      return (
        <Shell>
          <section aria-label="Film" className="flex flex-col gap-4">
            <MarketingVideoPoster
              href={film.videoUrl}
              title={film.title}
              className="mx-auto w-full max-w-5xl"
              {...(film.imageUrl
                ? {
                    poster: (
                      <ArtMediaImage
                        src={film.imageUrl}
                        alt=""
                        sizes="(min-width: 64rem) 64rem, 100vw"
                        className="absolute inset-0 size-full"
                        imgClassName="object-cover"
                      />
                    ),
                  }
                : {})}
            />
            <p className="mx-auto w-full max-w-5xl font-headline text-xl font-medium">
              <Link href={film.href} className="art-focus-ring rounded-sm hover:underline">
                {film.title}
              </Link>
            </p>
          </section>
        </Shell>
      );
    }
    case "collecting":
      return (
        <MarketingSplitFeature
          tone="feature"
          mediaSide="right"
          title={ART_HUB_COLLECTING.title}
          body={<p>{ART_HUB_COLLECTING.body}</p>}
          action={
            <Button asChild size="lg" className="min-h-11 font-label">
              <Link href={ART_HUB_COLLECTING.cta.href}>{ART_HUB_COLLECTING.cta.label}</Link>
            </Button>
          }
        />
      );
    case "press":
      return <ArtHubPressBand rows={vm.press} />;
    case "ecosystem":
      return (
        <ArtHomeEcosystemBand
          cards={vm.ecosystem}
          heading={{
            title: ART_HUB_HEADINGS.ecosystem,
            subtitle: ART_HUB_HEADINGS.ecosystemSubtitle,
          }}
        />
      );
  }
}

export default async function ArtHubPage() {
  const result = await composeArtHubPage(artServices);
  if (result.status !== "ok") {
    return (
      <div className={cn(MARKETING_PAGE_SHELL, "py-10")}>
        <ArtEditorialStatus
          result={result}
          disabledTitle="Art Hub coming soon"
          disabledDescription="Editorial programming is not enabled in this environment yet."
          emptyTitle="Art Hub is empty"
          emptyDescription="Stories, films and episodes will appear here when published."
        />
      </div>
    );
  }

  const vm = result.data;
  return (
    <div className="flex flex-col gap-[var(--section-spacing-tight)] pb-[var(--section-spacing-tight)]">
      {vm.sections.map((id, index) => (
        <MarketingReveal key={id} index={index}>
          <HubSection id={id} vm={vm} />
        </MarketingReveal>
      ))}
    </div>
  );
}
