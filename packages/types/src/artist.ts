/** Artist Kind - taxonomy for the artist registry */
export const artistKinds = ["artist", "maker", "brand", "marque"] as const;
export type ArtistKind = (typeof artistKinds)[number];

/** Artist Status - lifecycle in the registry */
export const artistStatuses = ["pending", "approved", "rejected", "merged_into"] as const;
export type ArtistStatus = (typeof artistStatuses)[number];

export type ArtistProfile = {
  id: string;
  displayName: string;
  slug: string;
  portraitUrl: string | null;
  heroImageUrl: string | null;
  shortBio: string | null;
  longBio: string | null;
  statement: string | null;
  nationality: string | null;
  location: string | null;
  birthYear: string | null;
  deathYear: string | null;
  websiteUrl: string | null;
  socialLinks: Record<string, string>;
  featured: boolean;
  verified: boolean;
  archived: boolean;
  kind?: ArtistKind;
  status?: ArtistStatus;
  /** merge target for duplicate resolution */
  mergedIntoArtistId?: string | null;
  /** @deprecated Use ownerLegalEntityId. Dual-write period until 0029. */
  ownerUserId: string | null;
  /** legal entity ownership - optional during migration */
  ownerLegalEntityId?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Admin artist table row: catalogue fields plus denormalized list metrics. */
export type AdminArtistListRow = ArtistProfile & {
  lotCount: number;
  aliasCount: number;
  ownerDisplayName: string | null;
  ownerImage: string | null;
};

export type AdminArtistListResult = {
  rows: AdminArtistListRow[];
  total: number;
};

/** Aggregates for the admin artists hub stats strip + sidebar badge. */
export type AdminArtistStats = {
  total: number;
  pendingReview: number;
  makerSellers: number;
  historical: number;
  brands: number;
  featured: number;
};

/** Public directory card with denormalized lot count for "X lots" links. */
export type PublicArtistDirectoryRow = ArtistProfile & {
  lotCount: number;
};

/** Per-letter facet bucket for the A–Z jump bar. */
export type PublicArtistLetterFacet = {
  /** Single character a–z, 0–9, or "other" for non-alphanumeric leading chars. */
  letter: string;
  count: number;
};

/** A decade bucket derived from `birth_year`. `key` is the URL-safe slug
 * (`"1900s"`, `"pre-1800"`), `label` is the human label, `count` is the
 * facet count under the *base* filter. */
export type PublicArtistDecadeFacet = {
  key: string;
  label: string;
  count: number;
};

/** Aggregates that power the public directory side filter rail and chip counts. */
export type PublicArtistDirectoryFacets = {
  /** Total approved, non-archived artists matching the *base* filter (kind/letter/etc. excluded
   * for chip context — see service for the exact contract). */
  total: number;
  featured: number;
  living: number;
  historical: number;
  byKind: Record<ArtistKind, number>;
  /** Number of artists in the base set with at least one upcoming
   * (`active` | `scheduled`) lot. */
  hasUpcoming: number;
  /** Top nationalities in the matching set (for the side rail). */
  topNationalities: Array<{ value: string; count: number }>;
  /** Top decades by `birth_year` in the matching set (for the side rail). */
  topDecades: PublicArtistDecadeFacet[];
  /** Per-letter buckets including 0–9 and `other`. */
  letters: PublicArtistLetterFacet[];
};

export type PublicArtistDirectoryResult = {
  rows: PublicArtistDirectoryRow[];
  total: number;
  facets: PublicArtistDirectoryFacets;
};

/** Public artist profile detail: catalogue fields + alias chips for the hero. */
export type PublicArtistDetail = ArtistProfile & {
  aliases: string[];
};

/** Guard counts evaluated before hard-deleting an artist profile. */
export type ArtistDeleteGuardCounts = {
  lotCount: number;
  mergeDependentCount: number;
  watchlistCount: number;
};

/** Admin delete eligibility for an artist profile. */
export type ArtistDeleteEligibility = {
  canDelete: boolean;
  blockers: string[];
  warnings: string[];
  confirmationPhrase: string | null;
  guards: ArtistDeleteGuardCounts;
};
