import { ArtAccountListStateView } from "@/components/account/art-account-list-state";
import { ArtAccountPage } from "@/components/account/art-account-shell";
import { ArtArtistGrid } from "@/components/catalogue/art-artist-grid";
import { ArtArtworkGrid } from "@/components/catalogue/art-artwork-grid";
import { ArtSection } from "@/components/layout/art-section";
import { composeArtAccountFavoritesPage } from "@/lib/account/account-page.composer";
import { artPrivatePageTitle } from "@/lib/art-private-page-metadata";
import { artServices } from "@/lib/art-services.server";

export const dynamic = "force-dynamic";
export const metadata = artPrivatePageTitle("Favourites");

export default async function ArtAccountFavoritesPage() {
  const result = await composeArtAccountFavoritesPage(artServices);
  return (
    <ArtAccountPage result={result} title="Favourites">
      {(vm) => (
        <div className="flex flex-col gap-12">
          <ArtSection id="saved-artworks" title="Saved artworks">
            <ArtAccountListStateView
              state={vm.artworks}
              empty={{
                title: "No saved artworks yet",
                description: "Tap the heart on any artwork to keep it here.",
                action: { href: "/artworks", label: "Browse artworks" },
              }}
              failedDescription="We could not load your saved artworks. Try again shortly."
            >
              {(cards) => (
                <ArtArtworkGrid
                  cards={cards}
                  favoriteAuth={vm.favoriteAuth}
                  aria-label="Saved artworks"
                />
              )}
            </ArtAccountListStateView>
          </ArtSection>
          <ArtSection id="followed-artists" title="Followed artists">
            <ArtAccountListStateView
              state={vm.artists}
              empty={{
                title: "Not following anyone yet",
                description: "Follow artists from their page to see them here.",
              }}
              failedDescription="We could not load the artists you follow. Try again shortly."
            >
              {(cards) => (
                <ArtArtistGrid
                  cards={cards}
                  favoriteAuth={vm.favoriteAuth}
                  aria-label="Followed artists"
                />
              )}
            </ArtAccountListStateView>
          </ArtSection>
        </div>
      )}
    </ArtAccountPage>
  );
}
