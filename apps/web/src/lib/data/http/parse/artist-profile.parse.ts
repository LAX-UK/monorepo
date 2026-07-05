import { isIndexableObject, toObjectRecord } from "@/lib/data/http/object-guards";
import type { ArtistKind, ArtistProfile, ArtistStatus } from "@auction/types";
import { artistKinds, artistStatuses } from "@auction/types";
import { coerceToDate } from "./coerce";

function parseArtistCategoryRefs(raw: unknown): NonNullable<ArtistProfile["categories"]> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      const row = isIndexableObject(entry) ? entry : {};
      return {
        id: String(row.id ?? ""),
        name: String(row.name ?? ""),
        slug: String(row.slug ?? ""),
      };
    })
    .filter((category) => category.id.length > 0);
}

function parseStringRecord(raw: unknown): Record<string, string> {
  if (!isIndexableObject(raw)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

/** Row parser for registry `ArtistProfile` payloads (`GET /artists/:id`, directory rows). */
export function parseArtistProfile(raw: unknown): ArtistProfile {
  const row = toObjectRecord(raw);
  const rawKind = row.kind;
  const kind =
    typeof rawKind === "string" && (artistKinds as readonly string[]).includes(rawKind)
      ? (rawKind as ArtistKind)
      : undefined;
  const rawStatus = row.status;
  const status =
    typeof rawStatus === "string" && (artistStatuses as readonly string[]).includes(rawStatus)
      ? (rawStatus as ArtistStatus)
      : undefined;

  return {
    id: String(row.id ?? ""),
    displayName: String(row.displayName ?? ""),
    slug: String(row.slug ?? ""),
    portraitUrl: row.portraitUrl == null ? null : String(row.portraitUrl),
    heroImageUrl: row.heroImageUrl == null ? null : String(row.heroImageUrl),
    shortBio: row.shortBio == null ? null : String(row.shortBio),
    longBio: row.longBio == null ? null : String(row.longBio),
    statement: row.statement == null ? null : String(row.statement),
    nationality: row.nationality == null ? null : String(row.nationality),
    location: row.location == null ? null : String(row.location),
    countryCode: row.countryCode == null ? null : String(row.countryCode),
    birthYear: row.birthYear == null ? null : String(row.birthYear),
    deathYear: row.deathYear == null ? null : String(row.deathYear),
    foundedYear: row.foundedYear == null ? null : String(row.foundedYear),
    dissolvedYear: row.dissolvedYear == null ? null : String(row.dissolvedYear),
    websiteUrl: row.websiteUrl == null ? null : String(row.websiteUrl),
    socialLinks: parseStringRecord(row.socialLinks),
    attributes: parseStringRecord(row.attributes),
    featured: Boolean(row.featured),
    verified: Boolean(row.verified),
    archived: Boolean(row.archived),
    ...(kind !== undefined ? { kind } : {}),
    ...(status !== undefined ? { status } : {}),
    categories: parseArtistCategoryRefs(row.categories),
    ownerUserId: row.ownerUserId == null ? null : String(row.ownerUserId),
    ownerLegalEntityId: row.ownerLegalEntityId == null ? null : String(row.ownerLegalEntityId),
    mergedIntoArtistId: row.mergedIntoArtistId == null ? null : String(row.mergedIntoArtistId),
    createdAt: coerceToDate(row.createdAt),
    updatedAt: coerceToDate(row.updatedAt),
  };
}
