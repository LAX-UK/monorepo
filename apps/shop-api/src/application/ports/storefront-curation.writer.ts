import type { PlannedPlacement } from "@auction/shop-domain";

export type ReplaceHomePlacementsCommand = {
  slots: Array<
    "featured_originals" | "featured_categories" | "featured_prints" | "featured_artists"
  >;
  placements: PlannedPlacement[];
  publishedAt: Date;
};

export interface StorefrontCurationWriter {
  replaceHomePlacements(command: ReplaceHomePlacementsCommand): Promise<void>;
}
