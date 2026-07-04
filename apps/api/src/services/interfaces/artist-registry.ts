import type {
  ArtistRecord,
  ArtistSearchHit,
  CreateArtistInput,
  MergeArtistInput,
  MergeArtistResult,
  ReviewArtistInput,
} from "@auction/persistence/interfaces";
import type { ArtistKind, ArtistStatus } from "@auction/types";

// Re-export so existing consumers importing from this module keep working,
// while @auction/types stays the single source of truth for the taxonomy.
export type { ArtistKind, ArtistStatus };

export type {
  ArtistRecord,
  ArtistSearchHit,
  ArtistSearchMatchType,
  CreateArtistInput,
  MergeArtistInput,
  MergeArtistResult,
  ReviewArtistInput,
} from "@auction/persistence/interfaces";

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

export type MergeArtistRouteInput = {
  intoArtistId: string;
  reason: string;
  confirmationPhrase: string;
};

/** Read-only artist registry: search, match browsing, and public lookup. */
export interface IArtistRegistryQueryService {
  /** Three-pass search: exact slug → exact alias → fuzzy on display + aliases. */
  search(query: string, limit?: number): Promise<ArtistSearchHit[]>;

  /** Produces three buckets the admin UI can render side
   * by side without a second round trip.
   */
  proposeMatches(input: ProposeMatchesInput): Promise<ProposeMatchesResult>;

  findById(id: string): Promise<ArtistRecord | null>;
  findBySlug(slug: string): Promise<ArtistRecord | null>;

  /** Slug availability — case-insensitive, suggests numeric suffix on collision. */
  checkNameAvailability(displayName: string): Promise<{
    available: boolean;
    suggestions: string[];
  }>;
}

/** Staff mutations: create, merge, review, alias management, and audited match proposals. */
export interface IArtistRegistryStaffCommandService {
  /** Creates an artist as `pending` (status). Caller user is recorded as
   * `created_by_user_id`. Slug derived from displayName + numeric suffix on
   * collision.
   */
  create(creatorUserId: string | null, input: CreateArtistInput): Promise<ArtistRecord>;

  /** Reserve a unique `artist_profile.slug` for the given display name (or
   * raw slug). The optional `ignoreArtistId` lets admin update flows keep
   * their own slug when no other artist holds it. Centralised here so the
   * admin facade (`ArtistProfileService`) and inline-create paths
   * (submission approve) share one collision policy. */
  resolveUniqueSlug(input: string, ignoreArtistId?: string): Promise<string>;

  /** Merge `from` → `into`. Re-points aliases and lots, marks the merged
   * row's status to `merged_into`, and writes an admin review task entry
   * with the reason for audit.
   */
  merge(reviewerUserId: string, input: MergeArtistInput): Promise<MergeArtistResult>;

  /** Validates merge confirmation phrase then delegates to {@link merge}. */
  mergeWithConfirmation(
    reviewerUserId: string,
    fromArtistId: string,
    input: MergeArtistRouteInput,
  ): Promise<MergeArtistResult>;

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

  /** Admin-only: same as {@link IArtistRegistryQueryService.proposeMatches} plus audit `domain_events` row. */
  proposeMatchesForAdmin(
    actorUserId: string,
    input: ProposeMatchesInput,
  ): Promise<ProposeMatchesResult>;
}

/** Composite artist registry — prefer narrow ports for new callers. */
export interface IArtistRegistryService
  extends IArtistRegistryQueryService,
    IArtistRegistryStaffCommandService {}
