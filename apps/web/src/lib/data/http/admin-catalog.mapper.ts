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

export function parseAdminCategory(raw: unknown): AdminCategory {
  const o = raw as Record<string, unknown>;
  const usageRaw = (o.usage ?? {}) as Record<string, unknown>;
  const lots = Number(usageRaw.lots ?? 0);
  const sales = Number(usageRaw.sales ?? 0);
  const submissions = Number(usageRaw.submissions ?? 0);
  return {
    id: String(o.id ?? ""),
    name: String(o.name ?? ""),
    slug: String(o.slug ?? ""),
    description: o.description == null ? null : String(o.description),
    archived: Boolean(o.archived ?? false),
    sortOrder: Number(o.sortOrder ?? 0),
    parentId: o.parentId == null ? null : String(o.parentId),
    heroImageKey: o.heroImageKey == null ? null : String(o.heroImageKey),
    createdAt: o.createdAt ? new Date(String(o.createdAt)) : new Date(),
    updatedAt: o.updatedAt ? new Date(String(o.updatedAt)) : new Date(),
    usage: {
      lots,
      sales,
      submissions,
      total: Number(usageRaw.total ?? lots + sales + submissions),
    },
  };
}

function parseArtistCategoryRefs(raw: unknown): NonNullable<ArtistProfile["categories"]> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      const o = entry as Record<string, unknown>;
      return {
        id: String(o.id ?? ""),
        name: String(o.name ?? ""),
        slug: String(o.slug ?? ""),
      };
    })
    .filter((c) => c.id.length > 0);
}

export function parseArtistProfile(raw: unknown): ArtistProfile {
  const o = raw as Record<string, unknown>;
  const rawKind = o.kind;
  const kind =
    typeof rawKind === "string" && (artistKinds as readonly string[]).includes(rawKind)
      ? (rawKind as ArtistKind)
      : undefined;
  const rawStatus = o.status;
  const status =
    typeof rawStatus === "string" && (artistStatuses as readonly string[]).includes(rawStatus)
      ? (rawStatus as ArtistStatus)
      : undefined;
  return {
    id: String(o.id ?? ""),
    displayName: String(o.displayName ?? ""),
    slug: String(o.slug ?? ""),
    portraitUrl: o.portraitUrl == null ? null : String(o.portraitUrl),
    heroImageUrl: o.heroImageUrl == null ? null : String(o.heroImageUrl),
    shortBio: o.shortBio == null ? null : String(o.shortBio),
    longBio: o.longBio == null ? null : String(o.longBio),
    statement: o.statement == null ? null : String(o.statement),
    nationality: o.nationality == null ? null : String(o.nationality),
    location: o.location == null ? null : String(o.location),
    countryCode: o.countryCode == null ? null : String(o.countryCode),
    birthYear: o.birthYear == null ? null : String(o.birthYear),
    deathYear: o.deathYear == null ? null : String(o.deathYear),
    foundedYear: o.foundedYear == null ? null : String(o.foundedYear),
    dissolvedYear: o.dissolvedYear == null ? null : String(o.dissolvedYear),
    websiteUrl: o.websiteUrl == null ? null : String(o.websiteUrl),
    socialLinks:
      o.socialLinks && typeof o.socialLinks === "object"
        ? (o.socialLinks as Record<string, string>)
        : {},
    attributes:
      o.attributes && typeof o.attributes === "object"
        ? (o.attributes as Record<string, string>)
        : {},
    featured: Boolean(o.featured),
    verified: Boolean(o.verified),
    archived: Boolean(o.archived),
    ...(kind !== undefined ? { kind } : {}),
    ...(status !== undefined ? { status } : {}),
    categories: parseArtistCategoryRefs(o.categories),
    ownerUserId: o.ownerUserId == null ? null : String(o.ownerUserId),
    ownerLegalEntityId: o.ownerLegalEntityId == null ? null : String(o.ownerLegalEntityId),
    mergedIntoArtistId: o.mergedIntoArtistId == null ? null : String(o.mergedIntoArtistId),
    createdAt: new Date(String(o.createdAt ?? "")),
    updatedAt: new Date(String(o.updatedAt ?? "")),
  };
}

export function parseAdminArtistListRow(raw: unknown): AdminArtistListRow {
  const base = parseArtistProfile(raw);
  const o = raw as Record<string, unknown>;
  return {
    ...base,
    lotCount: Number(o.lotCount ?? 0),
    aliasCount: Number(o.aliasCount ?? 0),
    ownerDisplayName: o.ownerDisplayName == null ? null : String(o.ownerDisplayName),
    ownerImage: o.ownerImage == null ? null : String(o.ownerImage),
  };
}

export function parseAdminArtistStats(raw: unknown): AdminArtistStats {
  const o = raw as Record<string, unknown>;
  return {
    total: Number(o.total ?? 0),
    pendingReview: Number(o.pendingReview ?? 0),
    makerSellers: Number(o.makerSellers ?? 0),
    historical: Number(o.historical ?? 0),
    brands: Number(o.brands ?? 0),
    featured: Number(o.featured ?? 0),
  };
}

export function parseArtistDeleteEligibility(raw: unknown): ArtistDeleteEligibility | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const guardsRaw = o.guards;
  const guards =
    guardsRaw && typeof guardsRaw === "object"
      ? {
          lotCount: Number((guardsRaw as Record<string, unknown>).lotCount ?? 0),
          mergeDependentCount: Number(
            (guardsRaw as Record<string, unknown>).mergeDependentCount ?? 0,
          ),
          watchlistCount: Number((guardsRaw as Record<string, unknown>).watchlistCount ?? 0),
        }
      : { lotCount: 0, mergeDependentCount: 0, watchlistCount: 0 };
  return {
    canDelete: o.canDelete === true,
    blockers: Array.isArray(o.blockers) ? o.blockers.map(String) : [],
    warnings: Array.isArray(o.warnings) ? o.warnings.map(String) : [],
    confirmationPhrase: typeof o.confirmationPhrase === "string" ? o.confirmationPhrase : null,
    guards,
  };
}
