import type { AdminArtistDuplicateHit } from "@/lib/data/http/admin-catalog.types";
import { isIndexableObject, toObjectRecord } from "@/lib/data/http/object-guards";
import type {
  AdminArtistListRow,
  AdminArtistStats,
  AdminCategory,
  ArtistDeleteEligibility,
  ArtistKind,
  ArtistProfile,
  ArtistStatus,
} from "@auction/types";
import { artistKinds, artistStatuses } from "@auction/types";
import { z } from "zod";

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

const adminCategorySchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row): AdminCategory => {
    const usageRaw = isIndexableObject(row.usage) ? row.usage : {};
    const lots = Number(usageRaw.lots ?? 0);
    const sales = Number(usageRaw.sales ?? 0);
    const submissions = Number(usageRaw.submissions ?? 0);
    return {
      id: String(row.id ?? ""),
      name: String(row.name ?? ""),
      slug: String(row.slug ?? ""),
      description: row.description == null ? null : String(row.description),
      archived: Boolean(row.archived ?? false),
      sortOrder: Number(row.sortOrder ?? 0),
      parentId: row.parentId == null ? null : String(row.parentId),
      heroImageKey: row.heroImageKey == null ? null : String(row.heroImageKey),
      createdAt: row.createdAt ? new Date(String(row.createdAt)) : new Date(),
      updatedAt: row.updatedAt ? new Date(String(row.updatedAt)) : new Date(),
      usage: {
        lots,
        sales,
        submissions,
        total: Number(usageRaw.total ?? lots + sales + submissions),
      },
    };
  });

const artistProfileSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row): ArtistProfile => {
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
      createdAt: new Date(String(row.createdAt ?? "")),
      updatedAt: new Date(String(row.updatedAt ?? "")),
    };
  });

const adminArtistListRowSchemaSimple = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row): AdminArtistListRow => {
    const base = artistProfileSchema.parse(row);
    return {
      ...base,
      lotCount: Number(row.lotCount ?? 0),
      aliasCount: Number(row.aliasCount ?? 0),
      ownerDisplayName: row.ownerDisplayName == null ? null : String(row.ownerDisplayName),
      ownerImage: row.ownerImage == null ? null : String(row.ownerImage),
    };
  });

const adminArtistStatsSchema = z.preprocess(toObjectRecord, z.record(z.unknown())).transform(
  (row): AdminArtistStats => ({
    total: Number(row.total ?? 0),
    pendingReview: Number(row.pendingReview ?? 0),
    makerSellers: Number(row.makerSellers ?? 0),
    historical: Number(row.historical ?? 0),
    brands: Number(row.brands ?? 0),
    featured: Number(row.featured ?? 0),
  }),
);

const artistDeleteEligibilitySchema = z
  .preprocess((raw) => raw, z.unknown())
  .transform((raw): ArtistDeleteEligibility | null => {
    if (!isIndexableObject(raw)) return null;
    const guardsRaw = raw.guards;
    const guards = isIndexableObject(guardsRaw)
      ? {
          lotCount: Number(guardsRaw.lotCount ?? 0),
          mergeDependentCount: Number(guardsRaw.mergeDependentCount ?? 0),
          watchlistCount: Number(guardsRaw.watchlistCount ?? 0),
        }
      : { lotCount: 0, mergeDependentCount: 0, watchlistCount: 0 };
    return {
      canDelete: raw.canDelete === true,
      blockers: Array.isArray(raw.blockers) ? raw.blockers.map(String) : [],
      warnings: Array.isArray(raw.warnings) ? raw.warnings.map(String) : [],
      confirmationPhrase:
        typeof raw.confirmationPhrase === "string" ? raw.confirmationPhrase : null,
      guards,
    };
  });

const adminArtistDuplicateHitSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row): AdminArtistDuplicateHit => {
    const kindValue = row.kind;
    const kind =
      typeof kindValue === "string" && (artistKinds as readonly string[]).includes(kindValue)
        ? (kindValue as ArtistKind)
        : "artist";
    const statusValue = row.status;
    const status =
      typeof statusValue === "string" && (artistStatuses as readonly string[]).includes(statusValue)
        ? (statusValue as ArtistStatus)
        : "approved";
    return {
      id: String(row.id ?? ""),
      displayName: String(row.displayName ?? ""),
      slug: String(row.slug ?? ""),
      kind,
      status,
      matchedAlias: row.matchedAlias == null ? null : String(row.matchedAlias),
      matchType: String(row.matchType ?? ""),
      score: Number(row.score ?? 0),
    };
  });

export const adminCategoryRowSchema = adminCategorySchema as z.ZodType<AdminCategory>;
export const artistProfileRowSchema = artistProfileSchema as z.ZodType<ArtistProfile>;
export const adminArtistListRowSchema =
  adminArtistListRowSchemaSimple as z.ZodType<AdminArtistListRow>;
export const adminArtistStatsRowSchema = adminArtistStatsSchema as z.ZodType<AdminArtistStats>;
export const artistDeleteEligibilityRowSchema =
  artistDeleteEligibilitySchema as z.ZodType<ArtistDeleteEligibility | null>;
export const adminArtistDuplicateHitRowSchema =
  adminArtistDuplicateHitSchema as z.ZodType<AdminArtistDuplicateHit>;

export const artistMergeResultSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row) => {
    const remaining = isIndexableObject(row.remaining) ? row.remaining : null;
    const canonical = isIndexableObject(row.canonical) ? row.canonical : null;
    return {
      remainingId: remaining?.id != null ? String(remaining.id) : "",
      canonicalId: canonical?.id != null ? String(canonical.id) : "",
    };
  }) as z.ZodType<{ remainingId: string; canonicalId: string }>;

export function parseAdminCategory(raw: unknown): AdminCategory {
  return adminCategorySchema.parse(raw);
}

export function parseArtistProfile(raw: unknown): ArtistProfile {
  return artistProfileSchema.parse(raw);
}

export function parseAdminArtistListRow(raw: unknown): AdminArtistListRow {
  return adminArtistListRowSchemaSimple.parse(raw);
}

export function parseAdminArtistStats(raw: unknown): AdminArtistStats {
  return adminArtistStatsSchema.parse(raw);
}

export function parseArtistDeleteEligibility(raw: unknown): ArtistDeleteEligibility | null {
  return artistDeleteEligibilitySchema.parse(raw);
}

export function parseAdminArtistDuplicateHit(raw: unknown): AdminArtistDuplicateHit {
  return adminArtistDuplicateHitSchema.parse(raw);
}

type _AdminCategoryInfer = z.infer<typeof adminCategorySchema>;
const _adminCategoryGuard = null as unknown as _AdminCategoryInfer satisfies AdminCategory;
void _adminCategoryGuard;
