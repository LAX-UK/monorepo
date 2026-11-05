import { ArtStatusState, ArtStatusStateLink } from "@/components/art-status-state";
import { ArtArtworkRail } from "@/components/catalogue/art-artwork-rail";
import { ArtEditorialCard } from "@/components/editorial/art-editorial-card";
import { ArtGalleryTeamBand } from "@/components/gallery-team/art-gallery-team-band";
import { ArtFeaturedArtists } from "@/components/home/art-featured-artists";
import { ArtHomeHero } from "@/components/home/art-home-hero";
import { ArtHomeWhatsOn } from "@/components/home/art-home-whats-on";
import { ArtSection } from "@/components/layout/art-section";
import { ArtMediaImage } from "@/components/media/art-media-image";
import { ArtProductDoors } from "@/components/product-doors/art-product-doors";
import { artServices } from "@/lib/art-services.server";
import { buildArtGalleryTeam } from "@/lib/gallery-team/art-gallery-team.vm";
import { buildArtHomeHeroVm } from "@/lib/home/art-home-hero.vm";
import {
  type ArtHomePageVm,
  type ArtHomeSectionId,
  composeArtHomePage,
} from "@/lib/home/home-page.composer";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import {
  MarketingCardRow,
  MarketingFeatureGrid,
  type MarketingFeatureGridRole,
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
  title: "London Art Gallery | Original Art for Sale | lax.art",
  description:
    "London Art Exchange, the gallery at 156 New Cavendish Street, London: original paintings, prints and sculptures for sale, private viewings and art advisory.",
  alternates: { canonical: "/" },
};

function Shell({ children }: { children: ReactNode }) {
  return <div className={MARKETING_PAGE_SHELL}>{children}</div>;
}

/** Three stories: a lead and two compact cards beside it, so the column never ends in empty space. */
function storyCardLayout(role: MarketingFeatureGridRole, count: number) {
  if (role === "solo") return "split";
  return role === "item" && count > 2 ? "row" : "stacked";
}

function HomeSection({ id, vm }: { id: ArtHomeSectionId; vm: ArtHomePageVm }) {
  switch (id) {
    case "whats-on":
      return (
        <Shell>
          <ArtSection id="home-whats-on" title="What's on across LAX" viewAllHref="/exhibitions">
            <ArtHomeWhatsOn cards={vm.whatsOn} />
          </ArtSection>
        </Shell>
      );
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
      return vm.featuredArtists ? (
        <Shell>
          <ArtFeaturedArtists artists={vm.featuredArtists} favoriteAuth={vm.favoriteAuth} />
        </Shell>
      ) : null;
    case "product-doors":
      return <ArtProductDoors doors={vm.productDoors} />;
    case "stories":
      return (
        <Shell>
          <ArtSection id="home-stories" title="Featured stories" viewAllHref="/art-hub">
            <MarketingFeatureGrid
              variant="lead-plus-stack"
              aria-label="Featured stories"
              items={vm.stories}
              getKey={(card) => card.key}
              renderItem={(card, role) => (
                <ArtEditorialCard
                  card={card}
                  aspect="cover"
                  layout={storyCardLayout(role, vm.stories.length)}
                />
              )}
            />
          </ArtSection>
        </Shell>
      );
    case "guide": {
      const { guidePromo } = vm;
      return (
        <MarketingSplitFeature
          title={guidePromo.title}
          body={<p>{guidePromo.body}</p>}
          mediaSide="right"
          tone={vm.surfaces.guide === "band" ? "feature" : "plain"}
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
            <Button asChild variant="secondaryOutline" size="lg">
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
            <MarketingCardRow
              aria-label="Our galleries"
              items={vm.galleries}
              getKey={(gallery) => gallery.key}
              renderItem={(gallery, layout) => (
                <MarketingVenueCard
                  href={gallery.href}
                  name={gallery.name}
                  addressLines={gallery.addressLines}
                  layout={layout === "feature" ? "wide" : "tile"}
                  {...(vm.textLed.galleries
                    ? {}
                    : {
                        image: (
                          <ArtMediaImage
                            src={gallery.imageUrl}
                            alt=""
                            label="Gallery"
                            placeholderTitle={gallery.name}
                            sizes={
                              layout === "feature"
                                ? "(min-width: 48rem) 55vw, 100vw"
                                : "(min-width: 48rem) 45vw, 100vw"
                            }
                            className="absolute inset-0 size-full"
                            imgClassName="object-cover"
                          />
                        ),
                      })}
                />
              )}
            />
          </ArtSection>
        </Shell>
      );
    case "closing-cta":
      return (
        <Shell>
          <ArtGalleryTeamBand team={buildArtGalleryTeam({ context: "home" })} viewer={vm.viewer} />
        </Shell>
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
