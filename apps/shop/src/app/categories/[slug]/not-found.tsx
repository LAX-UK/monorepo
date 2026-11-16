import { ArtworkDetailState } from "@/components/artwork/artwork-detail-state";
import { ticket } from "@auction/ui/lax/drawings";

export default function CategoryNotFound() {
  return (
    <ArtworkDetailState
      drawing={{ name: "ticket", paths: ticket }}
      eyebrow="Not found"
      title="Category not found"
      description="This category may have moved or is no longer shown in the public catalogue."
    />
  );
}
