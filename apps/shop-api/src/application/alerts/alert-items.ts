import type { MatchSnapshot } from "@auction/alerts";
import type { AlertArtwork } from "./alert-ports.js";

const ARTWORK_PREFIX = "artwork:";

/** The ledger's key for a work: unique per person and topic, so a work reaches a person once. */
export function artworkItemKey(artworkId: string): string {
  return `${ARTWORK_PREFIX}${artworkId}`;
}

export function artworkIdOfItemKey(itemKey: string): string | null {
  return itemKey.startsWith(ARTWORK_PREFIX) ? itemKey.slice(ARTWORK_PREFIX.length) : null;
}

/** What a digest shows about a work, kept with the match so the email can be built later. */
export function artworkSnapshot(
  artwork: AlertArtwork,
  options: { groupLabel?: string } = {},
): MatchSnapshot {
  return {
    title: artwork.title,
    subtitle: artwork.artistName,
    ...(artwork.imageUrl ? { imageUrl: artwork.imageUrl } : {}),
    path: `/artworks/${artwork.slug}`,
    ...(options.groupLabel ? { groupLabel: options.groupLabel } : {}),
  };
}
