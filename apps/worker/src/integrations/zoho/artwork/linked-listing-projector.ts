import type { ArtworkRegisterEntry } from "@auction/artwork-register-contracts";

/** What Zoho owns about an artwork, as a lax.art listing made from it shows it. */
export type ListingFacts = Pick<
  ArtworkRegisterEntry,
  "zohoProductId" | "title" | "medium" | "dimensions" | "year" | "imageRefs"
> & { artistCode: string };

/**
 * Keeps the lax.art listing made from a register record in step with Zoho. A change in Zoho
 * reaches the draft or the live listing here, because the listing's title, artist, medium, size,
 * year and images are Zoho's (staff cannot edit them on lax.art). Safe to repeat: it writes only
 * what differs. The web address never changes.
 */
export interface LinkedListingProjector {
  project(facts: ListingFacts): Promise<void>;
}

export function listingFactsOf(entry: ArtworkRegisterEntry): ListingFacts {
  return {
    zohoProductId: entry.zohoProductId,
    title: entry.title,
    medium: entry.medium,
    dimensions: entry.dimensions,
    year: entry.year,
    imageRefs: entry.imageRefs,
    artistCode: entry.artist.code,
  };
}
