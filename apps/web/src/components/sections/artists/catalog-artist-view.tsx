import {
  ArtistBrowseCard,
  ArtistBrowseGrid,
  ArtistBrowseList,
} from "@/components/sections/artists/catalog-artist-views";
import type { ArtistProfileLinkContext } from "@/lib/marketing/catalog-links";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import type { PublicArtistDirectoryRow } from "@auction/types";

export type CatalogArtistViewProps = {
  view: CatalogLayoutView;
  rows: PublicArtistDirectoryRow[];
  watchSet: ReadonlySet<string>;
  isAuthenticated: boolean;
  profileLinkContext?: ArtistProfileLinkContext;
};

export function CatalogArtistView({
  view,
  rows,
  watchSet,
  isAuthenticated,
  profileLinkContext,
}: CatalogArtistViewProps) {
  if (view === "list") {
    return (
      <ArtistBrowseList
        rows={rows}
        watchSet={watchSet}
        isAuthenticated={isAuthenticated}
        {...(profileLinkContext ? { profileLinkContext } : {})}
      />
    );
  }
  if (view === "card") {
    return (
      <ArtistBrowseCard
        rows={rows}
        watchSet={watchSet}
        isAuthenticated={isAuthenticated}
        {...(profileLinkContext ? { profileLinkContext } : {})}
      />
    );
  }
  return (
    <ArtistBrowseGrid
      rows={rows}
      watchSet={watchSet}
      isAuthenticated={isAuthenticated}
      {...(profileLinkContext ? { profileLinkContext } : {})}
    />
  );
}
