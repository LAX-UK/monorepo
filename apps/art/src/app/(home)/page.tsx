import { ArtStatusState, ArtStatusStateLink } from "@/components/art-status-state";
import { ArtArtistCard } from "@/components/catalogue/art-artist-grid";
import { ArtArtworkRail } from "@/components/catalogue/art-artwork-rail";
import { ArtEditorialCard } from "@/components/editorial/art-editorial-card";
import { ArtGeneralEnquiryPanel } from "@/components/enquiry/art-general-enquiry-panel";
import { ArtHomeEcosystemBand } from "@/components/home/art-home-ecosystem-band";
import { ArtHomeHero } from "@/components/home/art-home-hero";
import { ArtRail, ArtRailItem } from "@/components/layout/art-rail";
import { ArtSection } from "@/components/layout/art-section";
import { ArtMediaImage } from "@/components/media/art-media-image";
import { artServices } from "@/lib/art-services.server";
import { artStorefrontLoginHref } from "@/lib/art-viewer-state";
import { buildArtHomeHeroVm } from "@/lib/home/art-home-hero.vm";
import { ART_HOME_CLOSING_CTA } from "@/lib/home/art-home-promos.vm";
import {
  type ArtHomePageVm,
  type ArtHomeSectionId,
  composeArtHomePage,
} from "@/lib/home/home-page.composer";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import {
  MarketingCtaBand,
  MarketingFeatureGrid,
  MarketingReveal,
  MarketingSplitFeature,
  MarketingVenueCard,
} from "@auction/marketing-ui";
import { Button } from "@auction/ui/components/button";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

/** Keeps the legacy www.thelax.art home page's ranking intent ("London art gallery", "art for sale"). */
export const metadata: Metadata = {
  title: "London Art Gallery | Original Art for Sale | LAX Art",
  description:
    "London Art Exchange, the gallery at 156 New Cavendish Street, London: original paintings, prints and sculptures for sale, private viewings and art advisory.",
  alternates: { canonical: "/" },
};

function Shell({ children }: { children: ReactNode }) {
  return <div className={MARKETING_PAGE_SHELL}>{children}</div>;
}

function HomeSection({ id, vm }: { id: ArtHomeSectionId; vm: ArtHomePageVm }) {
  switch (id) {
    case "whats-on": {
      const [lead, ...rest] = vm.whatsOn;
      if (!lead) return null;
      return (
        <Shell>
          <ArtSection id="home-whats-on" title="What's on across LAX" viewAllHref="/exhibitions">
            <MarketingFeatureGrid
              variant="lead-plus-row"
              aria-label="What's on"
              // The editorial card is 4:3; capping the lead keeps it from filling the viewport.
              lead={
                <div className="mx-auto w-full max-w-[56rem]">
                  <ArtEditorialCard card={lead} priority />
                </div>
              }
            >
              {rest.map((card) => (
                <ArtEditorialCard key={card.key} card={card} />
              ))}
            </MarketingFeatureGrid>
          </ArtSection>
        </Shell>
      );
    }
    case "curators-picks":
      return (
        <Shell>
          <ArtSection id="curators-picks" title="Curators' picks" viewAllHref="/artworks">
            {vm.sectionErrors.includes("artworks") ? (
              <ArtStatusState
                variant="error"
                title="Featured works are unavailable"
                description="We could not load featured originals. Try again shortly."
                actions={
                  <ArtStatusStateLink href="/artworks">Browse all artworks</ArtStatusStateLink>
                }
              />
            ) : vm.featuredArtworks.length === 0 ? (
              <ArtStatusState
                variant="empty"
                title="New originals are on the way"
                description="There are no featured originals right now. Browse the full catalogue in the meantime."
                actions={<ArtStatusStateLink href="/artworks">Browse artworks</ArtStatusStateLink>}
              />
            ) : (
              <ArtArtworkRail
                id="curators-picks-rail"
                label="Curators' picks"
                cards={vm.featuredArtworks}
                favoriteAuth={vm.favoriteAuth}
              />
            )}
          </ArtSection>
        </Shell>
      );
    case "featured-artists":
      return (
        <Shell>
          <ArtSection id="featured-artists" title="Featured artists" viewAllHref="/artists">
            <ArtRail id="featured-artists-rail" label="Featured artists">
              {vm.featuredArtists.map((card) => (
                <ArtRailItem key={card.slug} size="tile">
                  <ArtArtistCard card={card} />
                </ArtRailItem>
              ))}
            </ArtRail>
          </ArtSection>
        </Shell>
      );
    case "ecosystem":
      return <ArtHomeEcosystemBand cards={vm.ecosystem} />;
    case "stories": {
      const [lead, ...rest] = vm.stories;
      if (!lead) return null;
      return (
        <Shell>
          <ArtSection id="home-stories" title="Featured stories" viewAllHref="/art-hub">
            <MarketingFeatureGrid
              variant="lead-plus-stack"
              aria-label="Featured stories"
              lead={<ArtEditorialCard card={lead} />}
            >
              {rest.map((card) => (
                <ArtEditorialCard key={card.key} card={card} />
              ))}
            </MarketingFeatureGrid>
          </ArtSection>
        </Shell>
      );
    }
    case "guide": {
      const { guidePromo } = vm;
      return (
        <MarketingSplitFeature
          title={guidePromo.title}
          body={<p>{guidePromo.body}</p>}
          mediaSide="right"
          tone="feature"
          {...(guidePromo.imageUrl
            ? {
                media: (
                  <ArtMediaImage
                    src={guidePromo.imageUrl}
                    alt=""
                    label="Collector guide"
                    sizes="(min-width: 48rem) 50vw, 100vw"
                    className="absolute inset-0 size-full"
                    imgClassName="object-cover"
                  />
                ),
              }
            : {})}
          action={
            <Button
              asChild
              variant="outline"
              size="lg"
              className="min-h-11 border-current bg-transparent font-label text-on-surface-feature hover:bg-surface-container-low/40"
            >
              <Link href={guidePromo.cta.href}>{guidePromo.cta.label}</Link>
            </Button>
          }
        />
      );
    }
    case "galleries":
      return (
        <Shell>
          <ArtSection id="home-galleries" title="Our galleries">
            <ul className="grid gap-x-10 gap-y-12 md:grid-cols-2" aria-label="Our galleries">
              {vm.galleries.map((gallery) => (
                <li key={gallery.key}>
                  <MarketingVenueCard
                    href={gallery.href}
                    name={gallery.name}
                    addressLines={gallery.addressLines}
                    image={
                      <ArtMediaImage
                        src={gallery.imageUrl}
                        alt=""
                        label="Gallery"
                        sizes="(min-width: 48rem) 45vw, 100vw"
                        className="absolute inset-0 size-full"
                        imgClassName="object-cover"
                      />
                    }
                  />
                </li>
              ))}
            </ul>
          </ArtSection>
        </Shell>
      );
    case "closing-cta":
      return (
        <MarketingCtaBand
          title={ART_HOME_CLOSING_CTA.title}
          body={<p>{ART_HOME_CLOSING_CTA.body}</p>}
          action={
            <ArtGeneralEnquiryPanel
              viewer={vm.viewer}
              loginHref={artStorefrontLoginHref("/")}
              triggerLabel={ART_HOME_CLOSING_CTA.triggerLabel}
            />
          }
        />
      );
  }
}

export default async function ArtHomePage() {
  const vm = await composeArtHomePage(artServices);

  return (
    <div className="flex flex-col gap-[var(--section-spacing-tight)]">
      <ArtHomeHero hero={buildArtHomeHeroVm(vm.hero)} />
      {vm.sections.map((id, index) => (
        <MarketingReveal key={id} index={index}>
          <HomeSection id={id} vm={vm} />
        </MarketingReveal>
      ))}
    </div>
  );
}
