"use client";

import { ArtworkDetailState } from "@/components/artwork/artwork-detail-state";
import { Button } from "@auction/ui/components/button";

export default function ArtworkDetailError({ reset }: { reset: () => void }) {
  return (
    <ArtworkDetailState
      eyebrow="Catalogue unavailable"
      title="Artwork unavailable"
      description="We could not load this work. The catalogue may be temporarily unavailable."
      motif="alert"
    >
      <Button type="button" className="min-h-11" onClick={reset}>
        Try again
      </Button>
    </ArtworkDetailState>
  );
}
