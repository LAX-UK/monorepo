import { ArtworkDetailState } from "@/components/artwork/artwork-detail-state";

export default function CategoryNotFound() {
  return (
    <ArtworkDetailState
      eyebrow="Not found"
      title="Category not found"
      description="This category may have moved or is no longer shown in the public catalogue."
    />
  );
}
