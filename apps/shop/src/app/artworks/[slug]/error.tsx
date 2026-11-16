"use client";

import { ArtworkDetailState } from "@/components/artwork/artwork-detail-state";
import { shopButtonClassName } from "@/components/shop-commerce-button";
import { Button } from "@auction/ui/components/button";
import { askew } from "@auction/ui/lax/drawings";

export default function ArtworkDetailError({ reset }: { reset: () => void }) {
  return (
    <ArtworkDetailState
      eyebrow="Catalogue unavailable"
      title="Artwork unavailable"
      description="We could not load this work. The catalogue may be temporarily unavailable."
      drawing={{ name: "askew", paths: askew }}
      actions={
        <Button
          type="button"
          className={shopButtonClassName("default", "standard")}
          onClick={reset}
        >
          Try again
        </Button>
      }
    />
  );
}
