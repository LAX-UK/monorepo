import { ArtworkDetailState } from "@/components/artwork/artwork-detail-state";
import { ticket } from "@auction/ui/lax/drawings";

export default function ArtistNotFound() {
  return (
    <ArtworkDetailState
      drawing={{ name: "ticket", paths: ticket }}
      eyebrow="Not found"
      title="Artist not found"
      description="This artist may have moved or is no longer shown in the public catalogue."
    />
  );
}
