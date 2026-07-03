import type { ArtistKind, ArtistStatus } from "@auction/types";

export type ArtistSearchMatchType = "exact" | "alias" | "partial" | "fuzzy";

export type ArtistSearchHit = {
  id: string;
  displayName: string;
  slug: string;
  kind: ArtistKind;
  status: ArtistStatus;
  /** When set, the matched alias text (when matchType='alias'). */
  matchedAlias: string | null;
  matchType: ArtistSearchMatchType;
  /** 0..1 confidence; for exact/alias this is 1, for fuzzy it's `similarity()`. */
  score: number;
};

export type ArtistRecord = {
  id: string;
  displayName: string;
  slug: string;
  kind: ArtistKind;
  status: ArtistStatus;
  mergedIntoArtistId: string | null;
  shortBio: string | null;
  nationality: string | null;
  birthYear: string | null;
  deathYear: string | null;
  createdByUserId: string | null;
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  reviewNotes: string | null;
  rejectionReason: string | null;
  archived: boolean;
  verified: boolean;
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateArtistInput = {
  displayName: string;
  kind?: ArtistKind | undefined;
  status?: ArtistStatus | undefined;
  shortBio?: string | undefined;
  nationality?: string | undefined;
  countryCode?: string | undefined;
  birthYear?: string | undefined;
  deathYear?: string | undefined;
  foundedYear?: string | undefined;
  dissolvedYear?: string | undefined;
  /** Kind-specific rich data; cleaned per kind before persistence. */
  attributes?: Record<string, string> | undefined;
  /** Collecting categories (departments) to attach. */
  categoryIds?: string[] | undefined;
  ownerUserId?: string | null | undefined;
};

export type MergeArtistInput = {
  /** Artist to be merged into. Survives. */
  intoArtistId: string;
  /** Artist losing identity; status flips to merged_into. */
  fromArtistId: string;
  reason: string;
};

export type MergeArtistResult = {
  merged: ArtistRecord;
  remaining: ArtistRecord;
  /** Number of aliases re-pointed at the surviving artist. */
  aliasesMoved: number;
  /** Number of lots re-pointed at the surviving artist. */
  lotsMoved: number;
};

export type ReviewArtistInput = {
  decision: "approved" | "rejected";
  reviewNotes?: string | undefined;
  rejectionReason?: string | undefined;
};
