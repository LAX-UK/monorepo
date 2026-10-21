import { ArtAccountListStateView } from "@/components/account/art-account-list-state";
import { ArtAccountPage } from "@/components/account/art-account-shell";
import { ArtArtworkGrid } from "@/components/catalogue/art-artwork-grid";
import { ArtSection } from "@/components/layout/art-section";
import { composeArtAccountSavesPage } from "@/lib/account/account-page.composer";
import { artPrivatePageTitle } from "@/lib/art-private-page-metadata";
import { artServices } from "@/lib/art-services.server";

export const dynamic = "force-dynamic";
export const metadata = artPrivatePageTitle("Favourites");

export default async function ArtAccountSavesPage() {
  const result = await composeArtAccountSavesPage(artServices);
  return (
    <ArtAccountPage result={result} title="Favourites" layout="favourites">
      {(vm) => (
        <ArtSection id="saved-artworks" title="Saved artworks">
          <ArtAccountListStateView
            state={vm.artworks}
            empty={{
              title: "No saved artworks",
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
      )}
    </ArtAccountPage>
  );
}
