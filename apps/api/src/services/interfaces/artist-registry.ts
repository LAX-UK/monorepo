export type ArtistKind = "artist" | "maker" | "brand" | "marque";
export type ArtistStatus = "pending" | "approved" | "rejected" | "merged_into";

export type ArtistSearchMatchType = "exact" | "alias" | "fuzzy";

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
  shortBio?: string | undefined;
  nationality?: string | undefined;
  birthYear?: string | undefined;
  deathYear?: string | undefined;
};

export type ProposeMatchesInput = {
  /** Free-text artist name from a lot. */
  name: string;
  /** Optional limit for fuzzy candidates (default 5). */
  limit?: number | undefined;
};

export type ProposeMatchesResult = {
  exact: ArtistSearchHit[];
  alias: ArtistSearchHit[];
  fuzzy: ArtistSearchHit[];
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

export interface IArtistRegistryService {
  /** Three-pass search: exact slug → exact alias → fuzzy on display + aliases. */
  search(query: string, limit?: number): Promise<ArtistSearchHit[]>;

  /** Produces three buckets the admin UI can render side
   * by side without a second round trip.
   */
  proposeMatches(input: ProposeMatchesInput): Promise<ProposeMatchesResult>;

  /** Admin-only: same as {@link proposeMatches} plus audit `domain_events` row. */
  proposeMatchesForAdmin(
    actorUserId: string,
    input: ProposeMatchesInput,
  ): Promise<ProposeMatchesResult>;

  findById(id: string): Promise<ArtistRecord | null>;
  findBySlug(slug: string): Promise<ArtistRecord | null>;

  /** Creates an artist as `pending` (status). Caller user is recorded as
   * `created_by_user_id`. Slug derived from displayName + numeric suffix on
   * collision.
   */
  create(creatorUserId: string | null, input: CreateArtistInput): Promise<ArtistRecord>;

  /** Slug availability — case-insensitive, suggests numeric suffix on collision. */
  checkNameAvailability(displayName: string): Promise<{
    available: boolean;
    suggestions: string[];
  }>;

  /** Merge `from` → `into`. Re-points aliases and lots, marks the merged
   * row's status to `merged_into`, and writes an admin review task entry
   * with the reason for audit.
   */
  merge(reviewerUserId: string, input: MergeArtistInput): Promise<MergeArtistResult>;

  /** Approve / reject a pending artist. On approve, also clears
   * `lot.artist_review_required` for any lots pointing at this artist.
   */
  review(reviewerUserId: string, artistId: string, input: ReviewArtistInput): Promise<ArtistRecord>;

  /** Add an alias to an existing artist; idempotent on (artistId, alias).
   */
  addAlias(
    creatorUserId: string | null,
    artistId: string,
    alias: string,
    kind?: string,
  ): Promise<{ id: string; alias: string }>;
}
