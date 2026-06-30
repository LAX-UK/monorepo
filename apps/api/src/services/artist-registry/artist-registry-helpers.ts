import type { artistProfile } from "@auction/db/schema";
import type { ArtistKind, ArtistRecord, ArtistStatus } from "../interfaces/artist-registry.js";

export const FUZZY_THRESHOLD = 0.4;

export function partialSearchPattern(query: string): string {
  return `%${query.trim().replace(/[%_\\]/g, "")}%`;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function rowToRecord(row: typeof artistProfile.$inferSelect): ArtistRecord {
  return {
    id: row.id as string,
    displayName: row.displayName as string,
    slug: row.slug as string,
    kind: (row.kind as ArtistKind) ?? "artist",
    status: (row.status as ArtistStatus) ?? "approved",
    mergedIntoArtistId: (row.mergedIntoArtistId as string | null) ?? null,
    shortBio: (row.shortBio as string | null) ?? null,
    nationality: (row.nationality as string | null) ?? null,
    birthYear: (row.birthYear as string | null) ?? null,
    deathYear: (row.deathYear as string | null) ?? null,
    createdByUserId: (row.createdByUserId as string | null) ?? null,
    reviewedByUserId: (row.reviewedByUserId as string | null) ?? null,
    reviewedAt: (row.reviewedAt as Date | null) ?? null,
    reviewNotes: (row.reviewNotes as string | null) ?? null,
    rejectionReason: (row.rejectionReason as string | null) ?? null,
    archived: Boolean(row.archived),
    verified: Boolean(row.verified),
    featured: Boolean(row.featured),
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
  };
}
