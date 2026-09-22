import { ArtworkDetailState } from "@/components/artwork/artwork-detail-state";

export default function ArtistNotFound() {
  return (
    <ArtworkDetailState
      eyebrow="Not found"
      title="Artist not found"
      description="This artist may have moved or is no longer shown in the public catalogue."
    />
  );
}
