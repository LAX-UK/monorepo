import { AdminArtistLotsPanel } from "@/components/admin/admin-artist-lots-panel";
import type { Lot } from "@auction/types";

type Props = {
  artistId: string;
  lots: Lot[];
};

/** The lots attributed to this artist. Attribution is changed from each lot's edit page. */
export function ArtistLotsTab({ artistId, lots }: Props) {
  return (
    <AdminArtistLotsPanel
      artistId={artistId}
      lots={lots}
      title="Lots by this artist"
      description="Change a lot's artist from the lot's own edit page."
    />
  );
}
