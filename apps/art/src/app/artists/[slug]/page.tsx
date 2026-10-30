import { ArtStatusState, ArtStatusStateLink } from "@/components/art-status-state";
import { ArtArtistBiography } from "@/components/artist/art-artist-biography";
import { ArtArtistHero } from "@/components/artist/art-artist-hero";
import { ArtArtistSellNote } from "@/components/artist/art-artist-sell-note";
import { ArtArtistWorks } from "@/components/artist/art-artist-works";
import { ArtEditorialCard } from "@/components/editorial/art-editorial-card";
import { ArtEditorialCardGrid } from "@/components/editorial/art-editorial-card";
import { ArtEditorialLink } from "@/components/editorial/art-editorial-link";
import { ArtGeneralEnquiryPanel } from "@/components/enquiry/art-general-enquiry-panel";
import { ArtGalleryTeamBand } from "@/components/gallery-team/art-gallery-team-band";
import { ArtSection } from "@/components/layout/art-section";
import { ArtJsonLd } from "@/components/seo/art-json-ld";
import { loadArtStorefrontBaseUrl } from "@/env.server";
import { artServices } from "@/lib/art-services.server";
import { composeArtistMetadata, composeArtistPage } from "@/lib/artist/artist-page.composer";
import {
  ARTIST_SECTION_IDS,
  ARTIST_SECTION_LABELS,
  artistWorksLayout,
} from "@/lib/artist/artist-profile.vm";
import { buildArtGalleryTeam } from "@/lib/gallery-team/art-gallery-team.vm";
import { notFoundOrUnavailable } from "@/lib/seo/page-status";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import {
  MARKETING_SURFACE_TONE,
  MarketingEditorialListRow,
  MarketingFeatureGrid,
  MarketingSubNav,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import type { Metadata } from "next";

type ArtistPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ArtistPageProps): Promise<Metadata> {
  const { slug } = await params;
  const meta = await composeArtistMetadata(artServices.catalogue, slug);
  if (meta.kind !== "ok") notFoundOrUnavailable(meta.kind, "Artist");
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: meta.canonicalPath },
  };
}

const SECTION = cn(MARKETING_PAGE_SHELL, "py-8 lg:py-12");

export default async function ArtistPage({ params }: ArtistPageProps) {
  const { slug } = await params;
  const siteUrl = loadArtStorefrontBaseUrl();
  const result = await composeArtistPage(artServices, slug, siteUrl);
  if (result.kind !== "ok") notFoundOrUnavailable(result.kind, "Artist");

  const { vm } = result;
  const pageUrl = new URL(`/artists/${encodeURIComponent(vm.slug)}`, siteUrl).toString();
  const worksHref = `/artworks?artistSlug=${encodeURIComponent(vm.slug)}`;
  const worksLayout = artistWorksLayout(vm.works.length);
  const soldLayout = artistWorksLayout(vm.soldWorks.length);
  const subject = { slug: vm.slug, label: vm.name };
  const askAbout = (title: string, body: string, label: string) => (
    <div className="flex flex-col items-start gap-4 border-t border-border-hairline pt-6 sm:border-t-0 sm:pt-0">
      <h3 className="font-headline text-xl font-medium leading-7 text-on-surface">{title}</h3>
      <p className="max-w-[40ch] text-base leading-7 text-on-surface-variant">{body}</p>
      <ArtGeneralEnquiryPanel
        viewer={vm.viewer}
        defaultTopic="general"
        contextSlug={vm.slug}
        contextLabel={vm.name}
        triggerLabel={label}
        triggerVariant="secondaryOutline"
      />
    </div>
  );

  return (
    <article className="flex flex-col">
      <ArtJsonLd data={vm.structuredData} />
      <ArtArtistHero vm={vm} pageUrl={pageUrl} />
      {vm.sectionTabs.length > 0 ? (
        <MarketingSubNav
          mode="anchor"
          sticky
          ariaLabel="Artist sections"
          items={vm.sectionTabs}
          identity={{ title: vm.name, meta: vm.lifeLine, imageSrc: vm.portraitUrl }}
        />
      ) : null}
      {vm.bio ? (
        <div className={SECTION}>
          <ArtArtistBiography vm={vm} />
        </div>
      ) : null}

      {vm.showWorks ? (
        <div id={ARTIST_SECTION_IDS.works} className={SECTION}>
          <ArtSection
            id="artist-works-list"
            title={ARTIST_SECTION_LABELS.works}
            {...(worksLayout === "grid" ? { viewAllHref: worksHref } : {})}
            viewAllSrLabel={`works by ${vm.name}`}
          >
            {vm.worksFailed ? (
              <ArtStatusState
                variant="error"
                title="Works unavailable"
                description="We could not load this artist's works. Try again shortly."
              />
            ) : worksLayout === null ? (
              <ArtStatusState
                variant="empty"
                title="No works listed yet"
                description="Follow this artist to hear when new works arrive."
                actions={<ArtStatusStateLink href="/artworks">Browse artworks</ArtStatusStateLink>}
              />
            ) : (
              <ArtArtistWorks
                cards={vm.works}
                layout={worksLayout}
                favoriteAuth={vm.favoriteAuth}
                aria-label={`Available works by ${vm.name}`}
                aside={askAbout(
                  `More by ${vm.name}`,
                  "Not every work is shown online. Ask the gallery team what is in the studio, or arrange to see this work in person.",
                  "Ask about other works",
                )}
              />
            )}
          </ArtSection>
        </div>
      ) : null}

      {soldLayout ? (
        <div
          id={ARTIST_SECTION_IDS.sold}
          className={cn(
            vm.soldSurface === "band" &&
              cn(MARKETING_SURFACE_TONE.feature.surface, "my-8 lg:my-12"),
          )}
        >
          <div className={SECTION}>
            <ArtSection
              id="artist-sold-list"
              title={ARTIST_SECTION_LABELS.sold}
              subtitle={
                vm.works.length > 0
                  ? `Part of ${vm.name}'s record with the gallery.`
                  : `Nothing by ${vm.name} is available right now. These works are part of their record with the gallery; ask us about similar works.`
              }
            >
              <ArtArtistWorks
                cards={vm.soldWorks}
                layout={soldLayout}
                favoriteAuth={vm.favoriteAuth}
                aria-label={`Sold works by ${vm.name}`}
                aside={askAbout(
                  "Looking for something similar?",
                  `The gallery team can tell you about works by ${vm.name} that are coming, or in private hands.`,
                  "Ask about similar works",
                )}
              />
            </ArtSection>
          </div>
        </div>
      ) : null}

      {vm.exhibitions.length > 0 ? (
        <div id={ARTIST_SECTION_IDS.exhibitions} className={SECTION}>
          <ArtSection id="artist-exhibitions-list" title={ARTIST_SECTION_LABELS.exhibitions}>
            <ArtEditorialCardGrid cards={vm.exhibitions} ariaLabel="Exhibitions featuring artist" />
          </ArtSection>
        </div>
      ) : null}

      {vm.stories.length > 0 ? (
        <div id={ARTIST_SECTION_IDS.stories} className={SECTION}>
          <ArtSection id="artist-stories-list" title={ARTIST_SECTION_LABELS.stories}>
            <MarketingFeatureGrid
              variant="lead-plus-row"
              aria-label="Films and stories"
              items={vm.stories}
              getKey={(card) => card.key}
              renderItem={(card, role) => (
                <ArtEditorialCard
                  card={card}
                  {...(role === "feature" ? { aspect: "wide" as const } : {})}
                  {...(role === "solo" ? { layout: "split" as const } : {})}
                />
              )}
            />
          </ArtSection>
        </div>
      ) : null}

      {vm.press.length > 0 ? (
        <div id={ARTIST_SECTION_IDS.press} className={SECTION}>
          <ArtSection id="artist-press-list" title={ARTIST_SECTION_LABELS.press}>
            <ul className="flex flex-col border-t border-border-hairline">
              {vm.press.map((row) => (
                <li key={row.key}>
                  <MarketingEditorialListRow
                    title={row.title}
                    kicker={row.publication}
                    meta={row.date}
                    href={row.href}
                    linkAs={ArtEditorialLink}
                  />
                </li>
              ))}
            </ul>
          </ArtSection>
        </div>
      ) : null}

      {vm.sellHref ? (
        <div className={SECTION}>
          <ArtArtistSellNote artistName={vm.name} href={vm.sellHref} />
        </div>
      ) : null}

      <ArtGalleryTeamBand
        className="mt-8 lg:mt-12"
        team={buildArtGalleryTeam({ context: "artist", subject })}
        viewer={vm.viewer}
      />
    </article>
  );
}
