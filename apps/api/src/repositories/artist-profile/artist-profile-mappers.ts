import type { artistProfile } from "@auction/db/schema";
import type { AdminArtistListRow, ArtistKind, ArtistProfile, ArtistStatus } from "@auction/types";

export function mapArtist(row: typeof artistProfile.$inferSelect): ArtistProfile {
  return {
    id: row.id,
    displayName: row.displayName,
    slug: row.slug,
    portraitUrl: row.portraitUrl,
    heroImageUrl: row.heroImageUrl,
    shortBio: row.shortBio,
    longBio: row.longBio,
    statement: row.statement,
    nationality: row.nationality,
    location: row.location,
    countryCode: row.countryCode ?? null,
    birthYear: row.birthYear,
    deathYear: row.deathYear,
    foundedYear: row.foundedYear ?? null,
    dissolvedYear: row.dissolvedYear ?? null,
    websiteUrl: row.websiteUrl,
    socialLinks: row.socialLinks ?? {},
    attributes: row.attributes ?? {},
    featured: row.featured,
    verified: row.verified,
    archived: row.archived,
    kind: row.kind as ArtistKind,
    status: row.status as ArtistStatus,
    mergedIntoArtistId: row.mergedIntoArtistId ?? null,
    ownerUserId: row.ownerUserId,
    ownerLegalEntityId: row.ownerLegalEntityId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapAdminListRow(
  row: typeof artistProfile.$inferSelect,
  extras: {
    lotCount: number;
    aliasCount: number;
    ownerDisplayName: string | null;
    ownerImage: string | null;
  },
): AdminArtistListRow {
  return { ...mapArtist(row), ...extras };
}
