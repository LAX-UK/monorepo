import { ArtStatusState, ArtStatusStateLink } from "@/components/art-status-state";
import { ArtArtistGrid } from "@/components/catalogue/art-artist-grid";
import { ArtArtworkGrid } from "@/components/catalogue/art-artwork-grid";
import { ArtSection } from "@/components/layout/art-section";
import { artServices } from "@/lib/art-services.server";
import { composeArtHomePage } from "@/lib/home/home-page.composer";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

export default async function ArtHomePage() {
  const vm = await composeArtHomePage(artServices);

  return (
    <div
      className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-[var(--section-spacing-tight)] pb-16")}
    >
      <section className="pt-6 lg:pt-12" aria-labelledby="art-home-title">
        <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking)] text-on-surface-variant">
          London Art Exchange
        </p>
        <h1
          id="art-home-title"
          className="mt-3 max-w-2xl font-headline text-[length:var(--text-display-lg)] font-semibold leading-tight tracking-tight text-on-surface"
        >
          Original works and gallery-led sales
        </h1>
        <p className="mt-4 max-w-xl text-lg text-on-surface-variant">
          Discover originals from the London Art Exchange and enquire directly with our gallery
          team.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg" className="min-h-11 font-label uppercase tracking-wide">
            <Link href="/artworks">View artworks</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="min-h-11 font-label uppercase tracking-wide"
          >
            <Link href="/search">Search</Link>
          </Button>
        </div>
      </section>

      <ArtSection id="featured-originals" title="Featured originals" viewAllHref="/artworks">
        {vm.sectionErrors.includes("artworks") ? (
          <ArtStatusState
            variant="error"
            title="Featured works are unavailable"
            description="We could not load featured originals. Try again shortly."
            actions={<ArtStatusStateLink href="/artworks">Browse all artworks</ArtStatusStateLink>}
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
            priorityCount={2}
          />
        )}
      </ArtSection>

      {vm.featuredArtists.length > 0 ? (
        <ArtSection id="featured-artists" title="Featured artists">
          <ArtArtistGrid cards={vm.featuredArtists} />
        </ArtSection>
      ) : null}
    </div>
  );
}
