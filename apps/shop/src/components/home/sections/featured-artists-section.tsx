import { ArtistCard } from "@/components/home/cards/artist-card";
import { ShopCatalogueState } from "@/components/home/shop-empty-state";
import { ShopSectionHeader } from "@/components/home/shop-section-header";
import type { HomePageViewModel } from "@/lib/home/home-page.vm";

type FeaturedArtistsSectionProps = {
  section: HomePageViewModel["sections"]["artists"];
  cards: HomePageViewModel["artists"];
  errorMessage?: string;
};

export function FeaturedArtistsSection({
  section,
  cards,
  errorMessage,
}: FeaturedArtistsSectionProps) {
  return (
    <section
      className="shop-home__section shop-home__section--artists"
      aria-labelledby="artists-heading"
    >
      <ShopSectionHeader headingId="artists-heading" {...section} />
      {cards.length > 0 ? (
        <div id="artists" className="shop-home__artists-grid">
          {cards.map((card) => (
            <ArtistCard key={card.id} card={card} />
          ))}
        </div>
      ) : errorMessage ? (
        <ShopCatalogueState
          variant="error"
          title="Featured artists are temporarily unavailable"
          description="We could not load featured artists. Try again or browse the artist directory."
          browseHref="/artists"
          browseLabel="Browse artists"
        />
      ) : (
        <ShopCatalogueState
          variant="empty"
          title="No featured artists yet"
          description="Artist profiles will appear here when they are featured on the shop home."
          browseHref="/artists"
          browseLabel="Browse artists"
          showRetry={false}
        />
      )}
    </section>
  );
}
