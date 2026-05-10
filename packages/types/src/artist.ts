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
