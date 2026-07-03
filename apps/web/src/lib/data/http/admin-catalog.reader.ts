import "server-only";

import {
  parseAdminArtistListRow,
  parseAdminArtistStats,
  parseAdminCategory,
  parseArtistDeleteEligibility,
  parseArtistProfile,
} from "@/lib/data/http/admin-catalog.mapper";
import {
  ADMIN_ARTIST_LIST_MAX_LIMIT,
  type AdminArtistDuplicateHit,
  type GetAdminArtistListParams,
} from "@/lib/data/http/admin-catalog.types";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import type {
  AdminArtistListResult,
  AdminArtistStats,
  AdminCategory,
  ArtistDeleteEligibility,
  ArtistKind,
  ArtistProfile,
  ArtistStatus,
} from "@auction/types";
import { artistKinds, artistStatuses } from "@auction/types";

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
