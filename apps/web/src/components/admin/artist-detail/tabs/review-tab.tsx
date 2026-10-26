import { AdminArtistReviewPanel } from "@/components/admin/admin-artist-review-panel";
import type { ArtistStatus } from "@auction/types";

type Props = {
  artistId: string;
  displayName: string;
  currentStatus: ArtistStatus;
};

export function ArtistReviewTab({ artistId, displayName, currentStatus }: Props) {
  return (
    <AdminArtistReviewPanel
      artistId={artistId}
      displayName={displayName}
      currentStatus={currentStatus}
    />
  );
}
