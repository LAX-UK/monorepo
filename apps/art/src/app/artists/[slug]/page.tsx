import { ArtStatusState, ArtStatusStateLink } from "@/components/art-status-state";
import { ArtArtistBiography } from "@/components/artist/art-artist-biography";
import { ArtArtistHero } from "@/components/artist/art-artist-hero";
import { ArtArtworkGrid } from "@/components/catalogue/art-artwork-grid";
import { ArtEditorialCardGrid } from "@/components/editorial/art-editorial-card";
import { ArtGeneralEnquiryPanel } from "@/components/enquiry/art-general-enquiry-panel";
import { ArtSection } from "@/components/layout/art-section";
import { ArtJsonLd } from "@/components/seo/art-json-ld";
import { loadArtStorefrontBaseUrl } from "@/env.server";
import { artServices } from "@/lib/art-services.server";
import { composeArtistMetadata, composeArtistPage } from "@/lib/artist/artist-page.composer";
import { ARTIST_SECTION_IDS } from "@/lib/artist/artist-profile.vm";
import { notFoundOrUnavailable } from "@/lib/seo/page-status";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { MarketingSplitFeature, MarketingSubNav } from "@auction/marketing-ui";
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
  return (
    <article className="flex flex-col pb-10 lg:pb-16">
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

      <div id={ARTIST_SECTION_IDS.works} className={SECTION}>
        <ArtSection id="artist-works-list" title="Featured works" viewAllHref={worksHref}>
          {vm.worksFailed ? (
            <ArtStatusState
              variant="error"
              title="Works unavailable"
              description="We could not load this artist's works. Try again shortly."
            />
          ) : vm.works.length === 0 ? (
            <ArtStatusState
              variant="empty"
              title="No works listed yet"
              description="Follow this artist to hear when new works arrive."
              actions={<ArtStatusStateLink href="/artworks">Browse artworks</ArtStatusStateLink>}
            />
          ) : (
            <ArtArtworkGrid cards={vm.works} favoriteAuth={vm.favoriteAuth} />
          )}
        </ArtSection>
      </div>

      {vm.exhibitions.length > 0 ? (
        <div id={ARTIST_SECTION_IDS.exhibitions} className={SECTION}>
          <ArtSection id="artist-exhibitions-list" title="Exhibitions">
            <ArtEditorialCardGrid cards={vm.exhibitions} ariaLabel="Exhibitions featuring artist" />
          </ArtSection>
        </div>
      ) : null}

      {vm.stories.length > 0 ? (
        <div id={ARTIST_SECTION_IDS.stories} className={SECTION}>
          <ArtSection id="artist-stories-list" title="Films & stories">
            <ArtEditorialCardGrid cards={vm.stories} ariaLabel="Films and stories" />
          </ArtSection>
        </div>
      ) : null}

      <MarketingSplitFeature
        className="mt-8 lg:mt-12"
        title={`Interested in selling a work by ${vm.name}?`}
        body="Tell us about the work and our specialists will come back with an estimate."
        action={
          <ArtGeneralEnquiryPanel
            viewer={vm.viewer}
            defaultTopic="selling"
            contextSlug={vm.slug}
            contextLabel={vm.name}
            triggerLabel="Request estimate"
          />
        }
      />
    </article>
  );
}
