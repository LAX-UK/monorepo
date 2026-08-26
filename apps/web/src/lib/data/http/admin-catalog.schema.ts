import type { AdminArtistDuplicateHit } from "@/lib/data/http/admin-catalog.types";
import { isIndexableObject, toObjectRecord } from "@/lib/data/http/object-guards";
import { parseArtistProfile as parseRegistryArtistProfile } from "@/lib/data/http/parse/artist-profile.parse";
import { zTransformParse } from "@/lib/data/http/schema-coerce";
import type {
  AdminArtistListRow,
  AdminArtistStats,
  AdminCategoriesListSummary,
  AdminCategory,
  ArtistDeleteEligibility,
  ArtistKind,
  ArtistProfile,
  ArtistStatus,
} from "@auction/types";
import { artistKinds, artistStatuses } from "@auction/types";
import { z } from "zod";

const adminCategorySchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row): AdminCategory => {
    const usageRaw = isIndexableObject(row.usage) ? row.usage : {};
    const lots = Number(usageRaw.lots ?? 0);
    const sales = Number(usageRaw.sales ?? 0);
    const submissions = Number(usageRaw.submissions ?? 0);
    const interests = Number(usageRaw.interests ?? 0);
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
        interests,
        total: Number(usageRaw.total ?? lots + sales + submissions + interests),
      },
    };
  });

const artistProfileSchema = zTransformParse(parseRegistryArtistProfile);

const adminArtistListRowSchemaSimple = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row): AdminArtistListRow => {
    const base = parseRegistryArtistProfile(row);
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
export const adminCategoriesListSummarySchema = z.object({
  totalCount: z.coerce.number(),
  activeCount: z.coerce.number(),
  archivedCount: z.coerce.number(),
  usageTotals: z.object({
    lots: z.coerce.number(),
    sales: z.coerce.number(),
    submissions: z.coerce.number(),
  }),
  mostUsedCategory: z
    .object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
      usage: z.object({
        lots: z.coerce.number(),
        sales: z.coerce.number(),
        submissions: z.coerce.number(),
        total: z.coerce.number(),
      }),
    })
    .nullable(),
}) satisfies z.ZodType<AdminCategoriesListSummary>;
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
  return parseRegistryArtistProfile(raw);
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
