import { ArtStatusState, ArtStatusStateLink } from "@/components/art-status-state";
import { ArtArtistGrid } from "@/components/catalogue/art-artist-grid";
import { ArtArtworkGrid } from "@/components/catalogue/art-artwork-grid";
import { ArtEditorialCardGrid } from "@/components/editorial/art-editorial-card";
import { ArtHomeHero } from "@/components/home/art-home-hero";
import { ArtSection } from "@/components/layout/art-section";
import { artServices } from "@/lib/art-services.server";
import { buildArtHomeHeroVm } from "@/lib/home/art-home-hero.vm";
import { composeArtHomePage } from "@/lib/home/home-page.composer";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { MarketingReveal } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import type { Metadata } from "next";

/** Keeps the legacy www.thelax.art home page's ranking intent ("London art gallery", "art for sale"). */
export const metadata: Metadata = {
  title: "London Art Gallery | Original Art for Sale | LAX Art",
  description:
    "London Art Exchange, the gallery at 156 New Cavendish Street, London: original paintings, prints and sculptures for sale, private viewings and art advisory.",
  alternates: { canonical: "/" },
};

export default async function ArtHomePage() {
  const vm = await composeArtHomePage(artServices);
  const editorial = vm.editorial.kind === "ok" ? vm.editorial : null;
  const hero = editorial?.hero ?? null;

  return (
    <div className="flex flex-col gap-[var(--section-spacing-tight)] pb-16">
      <ArtHomeHero hero={buildArtHomeHeroVm(hero)} />

      <div className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-[var(--section-spacing-tight)]")}>
        {editorial && editorial.whatsOn.length > 0 ? (
          <MarketingReveal index={0}>
            <ArtSection id="home-whats-on" title="What's on" viewAllHref="/exhibitions">
              <ArtEditorialCardGrid cards={editorial.whatsOn} ariaLabel="What's on" />
            </ArtSection>
          </MarketingReveal>
        ) : null}

        <MarketingReveal index={1}>
          <ArtSection id="featured-originals" title="Featured originals" viewAllHref="/artworks">
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
              <ArtArtworkGrid cards={vm.featuredArtworks} favoriteAuth={vm.favoriteAuth} />
            )}
          </ArtSection>
        </MarketingReveal>

        {editorial && editorial.stories.length > 0 ? (
          <MarketingReveal index={2}>
            <ArtSection id="home-stories" title="Stories" viewAllHref="/art-hub">
              <ArtEditorialCardGrid cards={editorial.stories} ariaLabel="Stories" />
            </ArtSection>
          </MarketingReveal>
        ) : null}

        {vm.featuredArtists.length > 0 ? (
          <MarketingReveal index={3}>
            <ArtSection id="featured-artists" title="Featured artists" viewAllHref="/artists">
              <ArtArtistGrid cards={vm.featuredArtists} />
            </ArtSection>
          </MarketingReveal>
        ) : null}

        {editorial && editorial.guide.length > 0 ? (
          <MarketingReveal index={4}>
            <ArtSection id="home-guide" title="Collector guide" viewAllHref="/collector-hub">
              <ArtEditorialCardGrid cards={editorial.guide} ariaLabel="Collector guide" />
            </ArtSection>
          </MarketingReveal>
        ) : null}
      </div>
    </div>
  );
}
