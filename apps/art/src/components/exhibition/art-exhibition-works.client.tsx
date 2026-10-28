"use client";

import { ArtArtworkGrid } from "@/components/catalogue/art-artwork-grid";
import type { CatalogueArtworkCardVm } from "@/lib/catalogue/catalogue-artwork-card.vm";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import { Button } from "@auction/ui/components/button";
import { useId, useState } from "react";

/** Works shown before "View more"; two rows of the four-column desktop grid. */
export const EXHIBITION_WORKS_PREVIEW_COUNT = 8;

type ArtExhibitionWorksProps = {
  cards: readonly CatalogueArtworkCardVm[];
  favoriteAuth: ArtFavoriteAuth;
};

/**
 * The exhibition's works. There is no catalogue filter for an exhibition's works, so "View more"
 * reveals the rest in place instead of linking to the catalogue.
 */
export function ArtExhibitionWorks({ cards, favoriteAuth }: ArtExhibitionWorksProps) {
  const gridId = useId();
  const [expanded, setExpanded] = useState(false);
  const hasMore = cards.length > EXHIBITION_WORKS_PREVIEW_COUNT;
  const shown = expanded ? cards : cards.slice(0, EXHIBITION_WORKS_PREVIEW_COUNT);

  return (
    <div className="flex flex-col items-start gap-8">
      <div id={gridId} className="w-full">
        <ArtArtworkGrid
          cards={shown}
          favoriteAuth={favoriteAuth}
          priorityCount={4}
          aria-label="Works in this exhibition"
        />
      </div>
      {hasMore ? (
        <Button
          type="button"
          variant="secondaryOutline"
          aria-expanded={expanded}
          aria-controls={gridId}
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? "Show fewer" : `View more (${cards.length - EXHIBITION_WORKS_PREVIEW_COUNT})`}
        </Button>
      ) : null}
    </div>
  );
}
