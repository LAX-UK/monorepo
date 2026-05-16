import {
  ArtistBrowseCard,
  ArtistBrowseGrid,
  ArtistBrowseList,
} from "@/components/sections/artists/catalog-artist-views";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import type { PublicArtistDirectoryRow } from "@auction/types";

export type CatalogArtistViewProps = {
  view: CatalogLayoutView;
  rows: PublicArtistDirectoryRow[];
  watchSet: ReadonlySet<string>;
  isAuthenticated: boolean;
};

export function CatalogArtistView({
  view,
  rows,
  watchSet,
  isAuthenticated,
}: CatalogArtistViewProps) {
  if (view === "list") {
    return <ArtistBrowseList rows={rows} watchSet={watchSet} isAuthenticated={isAuthenticated} />;
  }
  if (view === "card") {
    return <ArtistBrowseCard rows={rows} watchSet={watchSet} isAuthenticated={isAuthenticated} />;
  }
  return <ArtistBrowseGrid rows={rows} watchSet={watchSet} isAuthenticated={isAuthenticated} />;
}
