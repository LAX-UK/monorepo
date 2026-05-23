import { AdminArtistLotsPanel } from "@/components/admin/admin-artist-lots-panel";
import { CatalogDetailTabPanel } from "@/components/admin/catalog";
import type { Lot } from "@auction/types";

type Props = {
  artistId: string;
  lots: Lot[];
};

export function ArtistLotsTab({ artistId, lots }: Props) {
  return (
    <CatalogDetailTabPanel
      title="Lots"
      description="Read-only FK attribution. Reassign from each lot's edit screen."
    >
      <AdminArtistLotsPanel artistId={artistId} lots={lots} />
    </CatalogDetailTabPanel>
  );
}
