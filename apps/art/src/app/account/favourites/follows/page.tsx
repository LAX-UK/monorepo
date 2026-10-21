import { ArtAccountListStateView } from "@/components/account/art-account-list-state";
import { ArtAccountPage } from "@/components/account/art-account-shell";
import { ArtFollowedArtistList } from "@/components/account/art-followed-artist-list";
import { ArtSection } from "@/components/layout/art-section";
import { composeArtAccountFollowsPage } from "@/lib/account/account-page.composer";
import { artPrivatePageTitle } from "@/lib/art-private-page-metadata";
import { artServices } from "@/lib/art-services.server";

export const dynamic = "force-dynamic";
export const metadata = artPrivatePageTitle("Followed artists");

export default async function ArtAccountFollowsPage() {
  const result = await composeArtAccountFollowsPage(artServices);
  return (
    <ArtAccountPage result={result} title="Favourites" layout="favourites">
      {(vm) => (
        <ArtSection id="followed-artists" title="Followed artists">
          <ArtAccountListStateView
            state={vm.artists}
            empty={{
              title: "Not following anyone yet",
              description: "Follow artists from their page to see them here.",
              action: { href: "/artists", label: "Browse artists" },
            }}
            failedDescription="We could not load the artists you follow. Try again shortly."
          >
            {(cards) => <ArtFollowedArtistList cards={cards} favoriteAuth={vm.favoriteAuth} />}
          </ArtAccountListStateView>
        </ArtSection>
      )}
    </ArtAccountPage>
  );
}
