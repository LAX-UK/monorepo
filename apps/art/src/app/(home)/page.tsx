import { ArtStatusState, ArtStatusStateLink } from "@/components/art-status-state";
import { ArtArtistGrid } from "@/components/catalogue/art-artist-grid";
import { ArtArtworkGrid } from "@/components/catalogue/art-artwork-grid";
import { ArtEditorialCardGrid } from "@/components/editorial/art-editorial-card";
import { ArtEditorialLink } from "@/components/editorial/art-editorial-link";
import { ArtSection } from "@/components/layout/art-section";
import { ArtMediaImage } from "@/components/media/art-media-image";
import { artServices } from "@/lib/art-services.server";
import { HERO_HEADLINE, composeArtHomePage } from "@/lib/home/home-page.composer";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { MarketingHero } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
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

const HERO_SUPPORTING =
  "Discover originals from the London Art Exchange and enquire directly with our gallery team.";

function HeroActions({ featured }: { featured: { href: string; label: string } | null }) {
  return (
    <div className="mt-8 flex flex-wrap gap-3">
      {featured ? (
        <Button asChild size="lg" className="min-h-11 font-label uppercase tracking-wide">
          <ArtEditorialLink href={featured.href}>{featured.label}</ArtEditorialLink>
        </Button>
      ) : null}
      <Button
        asChild
        size="lg"
        variant={featured ? "outline" : "default"}
        className="min-h-11 font-label uppercase tracking-wide"
      >
        <Link href="/artworks">View artworks</Link>
      </Button>
      {featured ? null : (
        <Button
          asChild
          size="lg"
          variant="outline"
          className="min-h-11 font-label uppercase tracking-wide"
        >
          <Link href="/exhibitions">Exhibitions</Link>
        </Button>
      )}
    </div>
  );
}

function HeroCopy({ kicker, headline }: { kicker: string; headline: string }): ReactNode {
  return (
    <>
      <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking)] text-on-surface-variant">
        {kicker}
      </p>
      <h1
        id="art-home-title"
        className="mt-3 max-w-2xl font-headline text-[length:var(--text-display-lg)] font-semibold leading-tight tracking-tight text-on-surface"
      >
        {headline}
      </h1>
    </>
  );
}

export default async function ArtHomePage() {
  const vm = await composeArtHomePage(artServices);
  const editorial = vm.editorial.kind === "ok" ? vm.editorial : null;
  const hero = editorial?.hero ?? null;
  const featured = hero?.href ? { href: hero.href, label: "Discover more" } : null;

  return (
    <div className="flex flex-col gap-[var(--section-spacing-tight)] pb-16">
      {hero?.imageUrl ? (
        <MarketingHero
          media={
            <ArtMediaImage
              src={hero.imageUrl}
              alt=""
              priority
              sizes="100vw"
              className="size-full"
              imgClassName="object-cover"
            />
          }
        >
          <HeroCopy kicker={hero.kicker ?? "London Art Exchange"} headline={hero.headline} />
          <HeroActions featured={featured} />
        </MarketingHero>
      ) : (
        <section
          className={cn(MARKETING_PAGE_SHELL, "pt-6 lg:pt-12")}
          aria-labelledby="art-home-title"
        >
          <HeroCopy kicker="London Art Exchange" headline={hero?.headline ?? HERO_HEADLINE} />
          <p className="mt-4 max-w-xl text-lg text-on-surface-variant">{HERO_SUPPORTING}</p>
          <HeroActions featured={featured} />
        </section>
      )}

      <div className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-[var(--section-spacing-tight)]")}>
        {editorial && editorial.whatsOn.length > 0 ? (
          <ArtSection id="home-whats-on" title="What's on" viewAllHref="/exhibitions">
            <ArtEditorialCardGrid cards={editorial.whatsOn} ariaLabel="What's on" />
          </ArtSection>
        ) : null}

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
            <ArtArtworkGrid
              cards={vm.featuredArtworks}
              favoriteAuth={vm.favoriteAuth}
              priorityCount={hero?.imageUrl ? 0 : 2}
            />
          )}
        </ArtSection>

        {editorial && editorial.stories.length > 0 ? (
          <ArtSection id="home-stories" title="Stories" viewAllHref="/art-hub">
            <ArtEditorialCardGrid cards={editorial.stories} ariaLabel="Stories" />
          </ArtSection>
        ) : null}

        {vm.featuredArtists.length > 0 ? (
          <ArtSection id="featured-artists" title="Featured artists" viewAllHref="/artists">
            <ArtArtistGrid cards={vm.featuredArtists} />
          </ArtSection>
        ) : null}

        {editorial && editorial.guide.length > 0 ? (
          <ArtSection id="home-guide" title="Collector guide" viewAllHref="/collector-hub">
            <ArtEditorialCardGrid cards={editorial.guide} ariaLabel="Collector guide" />
          </ArtSection>
        ) : null}
      </div>
    </div>
  );
}
