import { ArtworkDetailState } from "@/components/artwork/artwork-detail-state";

export default function ArtworkNotFound() {
  return (
    <ArtworkDetailState
      eyebrow="Not found"
      title="Artwork not found"
      description="This work may have moved or is no longer shown in the public catalogue."
    />
  );
}
