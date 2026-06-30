import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import type {
  AdminArtistListResult,
  AdminArtistListRow,
  AdminArtistStats,
  AdminCategory,
  ArtistDeleteEligibility,
  ArtistKind,
  ArtistProfile,
  ArtistStatus,
} from "@auction/types";
import { artistKinds, artistStatuses } from "@auction/types";

function parseAdminCategory(raw: unknown): AdminCategory {
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

function parseArtistProfile(raw: unknown): ArtistProfile {
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

function parseAdminArtistListRow(raw: unknown): AdminArtistListRow {
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

function parseAdminArtistStats(raw: unknown): AdminArtistStats {
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

export async function getAdminCategoryList(
  params: {
    includeArchived?: boolean;
    q?: string;
  } = {},
): Promise<AdminCategory[]> {
  const qs = new URLSearchParams();
  if (params.includeArchived) qs.set("includeArchived", "true");
  const res = await authedServerFetch(`/admin/categories${qs.size ? `?${qs.toString()}` : ""}`);
  if (!res.ok) throw new Error(`Failed to load categories: ${res.status}`);
  const body = (await res.json()) as { data: unknown[] };
  const categories = body.data.map(parseAdminCategory);
  const needle = params.q?.trim().toLowerCase();
  if (!needle) return categories;
  return categories.filter((category) =>
    [category.name, category.slug, category.description ?? ""].some((value) =>
      value.toLowerCase().includes(needle),
    ),
  );
}

export async function getAdminCategoryById(id: string): Promise<AdminCategory | null> {
  const res = await authedServerFetch(`/admin/categories/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load category: ${res.status}`);
  const body = (await res.json()) as { data: unknown };
  return parseAdminCategory(body.data);
}

export type GetAdminArtistListParams = {
  includeArchived?: boolean;
  archivedOnly?: boolean;
  q?: string;
  kind?: string;
  kinds?: string;
  status?: string;
  ownerUserId?: string;
  categoryId?: string;
  country?: string;
  featured?: boolean;
  verified?: boolean;
  linked?: "yes" | "no";
  sort?: string;
  limit?: number;
  offset?: number;
};

/** Matches {@link adminArtistListQuerySchema} max on the API. */
const ADMIN_ARTIST_LIST_MAX_LIMIT = 200;

export async function getAdminArtistList(
  params: GetAdminArtistListParams = {},
): Promise<AdminArtistListResult> {
  const qs = new URLSearchParams();
  if (params.includeArchived) qs.set("includeArchived", "true");
  if (params.archivedOnly) qs.set("archivedOnly", "true");
  if (params.q) qs.set("q", params.q);
  if (params.kind) qs.set("kind", params.kind);
  if (params.kinds) qs.set("kinds", params.kinds);
  if (params.status) qs.set("status", params.status);
  if (params.ownerUserId) qs.set("ownerUserId", params.ownerUserId);
  if (params.categoryId) qs.set("categoryId", params.categoryId);
  if (params.country) qs.set("country", params.country);
  if (params.featured === true) qs.set("featured", "true");
  if (params.verified === true) qs.set("verified", "true");
  if (params.linked) qs.set("linked", params.linked);
  if (params.sort) qs.set("sort", params.sort);
  const limit = Math.min(ADMIN_ARTIST_LIST_MAX_LIMIT, Math.max(10, params.limit ?? 50));
  qs.set("limit", String(limit));
  qs.set("offset", String(params.offset ?? 0));
  const query = qs.toString();
  const res = await authedServerFetch(`/admin/artists?${query}`);
  if (!res.ok) throw new Error(`Failed to load artists: ${res.status}`);
  const body = (await res.json()) as { data: { rows: unknown[]; total: number } };
  return {
    rows: body.data.rows.map(parseAdminArtistListRow),
    total: body.data.total,
  };
}

export async function getAdminArtistStats(): Promise<AdminArtistStats> {
  const res = await authedServerFetch("/admin/artists/stats");
  if (!res.ok) throw new Error(`Failed to load artist stats: ${res.status}`);
  const body = (await res.json()) as { data: unknown };
  return parseAdminArtistStats(body.data);
}

export type AdminArtistDuplicateHit = {
  id: string;
  displayName: string;
  slug: string;
  kind: ArtistKind;
  status: ArtistStatus;
  matchedAlias: string | null;
  matchType: string;
  score: number;
};

export async function getAdminArtistDuplicateCandidates(
  artistId: string,
): Promise<AdminArtistDuplicateHit[]> {
  const res = await authedServerFetch(`/admin/artists/${encodeURIComponent(artistId)}/duplicates`);
  if (!res.ok) throw new Error(`Failed to load duplicate candidates: ${res.status}`);
  const body = (await res.json()) as { data: unknown[] };
  return body.data.map((raw) => {
    const o = raw as Record<string, unknown>;
    const k = o.kind;
    const kind =
      typeof k === "string" && (artistKinds as readonly string[]).includes(k)
        ? (k as ArtistKind)
        : "artist";
    const st = o.status;
    const status =
      typeof st === "string" && (artistStatuses as readonly string[]).includes(st)
        ? (st as ArtistStatus)
        : "approved";
    return {
      id: String(o.id ?? ""),
      displayName: String(o.displayName ?? ""),
      slug: String(o.slug ?? ""),
      kind,
      status,
      matchedAlias: o.matchedAlias == null ? null : String(o.matchedAlias),
      matchType: String(o.matchType ?? ""),
      score: Number(o.score ?? 0),
    };
  });
}

/** Artist profiles where `ownerUserId` matches (includes archived). */
export async function getAdminArtistsByOwnerUserId(ownerUserId: string): Promise<ArtistProfile[]> {
  const { rows } = await getAdminArtistList({ ownerUserId, includeArchived: true, limit: 200 });
  return rows;
}

export async function getAdminArtistById(id: string): Promise<ArtistProfile | null> {
  const res = await authedServerFetch(`/admin/artists/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load artist: ${res.status}`);
  const body = (await res.json()) as { data: unknown };
  return parseArtistProfile(body.data);
}

function parseArtistDeleteEligibility(raw: unknown): ArtistDeleteEligibility | null {
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

export async function getAdminArtistDeleteEligibility(
  artistId: string,
): Promise<ArtistDeleteEligibility | null> {
  const res = await authedServerFetch(
    `/artists/${encodeURIComponent(artistId)}/delete-eligibility`,
  );
  if (res.status === 404) return null;
  if (res.status === 403) return null;
  if (!res.ok) throw new Error(`Failed to load artist delete eligibility: ${res.status}`);
  const body = (await res.json()) as { data: unknown };
  return parseArtistDeleteEligibility(body.data);
}
