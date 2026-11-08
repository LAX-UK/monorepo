/** What LAX knows about one prints listing, as the Zoho print group is worked out from it. */
export type PrintGroupFacts = {
  printsArtworkId: string;
  title: string;
  medium: string | null;
  dimensions: string | null;
  year: number | null;
  /** The original the prints were made from; null for a listing that is not a print of one. */
  original: { artworkId: string; zohoProductId: string | null } | null;
  /** "Numbered" for a limited run, "Open" for an open edition; null while no run is recorded. */
  editionType: "Numbered" | "Open" | null;
  /** Prints in the run, and how many each holder owns. */
  total: number;
  collector: number;
  artist: number;
  lax: number;
};

/** Reads the prints listing behind an event. The mirror depends on this, not on Shop's tables. */
export interface PrintGroupFactsReader {
  /** Null when the listing no longer exists. */
  read(printsArtworkId: string): Promise<PrintGroupFacts | null>;
}
