import type { ArtistKind, ArtistStatus } from "@auction/types";

/** One artist found by the staff search: who it is, and how the search matched it. */
export type ArtistSearchHit = {
  id: string;
  displayName: string;
  slug: string;
  kind: ArtistKind;
  status: ArtistStatus;
  matchedAlias: string | null;
  matchType: "exact" | "alias" | "partial" | "fuzzy";
  score: number;
};
