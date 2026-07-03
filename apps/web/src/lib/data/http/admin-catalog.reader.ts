import "server-only";

import {
  adminArtistDuplicateHitRowSchema,
  adminArtistListRowSchema,
  adminArtistStatsRowSchema,
  adminCategoryRowSchema,
  artistDeleteEligibilityRowSchema,
  artistProfileRowSchema,
} from "@/lib/data/http/admin-catalog.schema";
import {
  ADMIN_ARTIST_LIST_MAX_LIMIT,
  type AdminArtistDuplicateHit,
  type GetAdminArtistListParams,
} from "@/lib/data/http/admin-catalog.types";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody, readListEnvelope } from "@/lib/data/http/envelope";
import type {
  AdminArtistListResult,
  AdminArtistStats,
  AdminCategory,
  ArtistDeleteEligibility,
  ArtistProfile,
} from "@auction/types";

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
  const body = await readJsonBody(res);
  const { rows: categories } = readListEnvelope(
    body,
    adminCategoryRowSchema,
    "GET /admin/categories",
  );
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
  const body = await readJsonBody(res);
  return readDataEnvelope(body, adminCategoryRowSchema, `GET /admin/categories/${id}`);
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
  const body = await readJsonBody(res);
  return readListEnvelope(body, adminArtistListRowSchema, "GET /admin/artists");
}

export async function getAdminArtistStats(): Promise<AdminArtistStats> {
  const res = await authedServerFetch("/admin/artists/stats");
  if (!res.ok) throw new Error(`Failed to load artist stats: ${res.status}`);
  const body = await readJsonBody(res);
  return readDataEnvelope(body, adminArtistStatsRowSchema, "GET /admin/artists/stats");
}

export async function getAdminArtistDuplicateCandidates(
  artistId: string,
): Promise<AdminArtistDuplicateHit[]> {
  const res = await authedServerFetch(`/admin/artists/${encodeURIComponent(artistId)}/duplicates`);
  if (!res.ok) throw new Error(`Failed to load duplicate candidates: ${res.status}`);
  const body = await readJsonBody(res);
  const { rows } = readListEnvelope(
    body,
    adminArtistDuplicateHitRowSchema,
    `GET /admin/artists/${artistId}/duplicates`,
  );
  return rows;
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
  const body = await readJsonBody(res);
  return readDataEnvelope(body, artistProfileRowSchema, `GET /admin/artists/${id}`);
}

/** Registry alias/fuzzy search for admin artist pickers (`GET /admin/artists/search`). */
export async function searchAdminArtistsRegistry(
  query: string,
  limit = 20,
): Promise<AdminArtistDuplicateHit[]> {
  const qs = new URLSearchParams({ q: query, limit: String(limit) });
  const res = await authedServerFetch(`/admin/artists/search?${qs.toString()}`);
  if (!res.ok) return [];
  const body = await readJsonBody(res);
  const { rows } = readListEnvelope(
    body,
    adminArtistDuplicateHitRowSchema,
    "GET /admin/artists/search",
  );
  return rows;
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
  const body = await readJsonBody(res);
  return readDataEnvelope(
    body,
    artistDeleteEligibilityRowSchema,
    `GET /artists/${artistId}/delete-eligibility`,
  );
}
