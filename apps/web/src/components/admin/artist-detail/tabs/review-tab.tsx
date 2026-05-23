import { AdminArtistReviewPanel } from "@/components/admin/admin-artist-review-panel";
import { CatalogDetailTabPanel } from "@/components/admin/catalog";
import type { ArtistStatus } from "@auction/types";

type Props = {
  artistId: string;
  currentStatus: ArtistStatus;
};

export function ArtistReviewTab({ artistId, currentStatus }: Props) {
  return (
    <CatalogDetailTabPanel
      title="Review"
      description="Approve or reject pending artist registry profiles before they appear in catalogue workflows."
    >
      <AdminArtistReviewPanel artistId={artistId} currentStatus={currentStatus} />
    </CatalogDetailTabPanel>
  );
}
