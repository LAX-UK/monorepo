import {
  ART_SLUG_LOOKUP,
  artCatalogueApiBaseUrl,
  artCatalogueFetch,
} from "@/lib/art-catalogue.server";
import { isArtEditorialEnabled } from "@/lib/art-runtime-flags";
import type {
  ArtEditorialArtistRelations,
  ArtEditorialExhibitionList,
  ArtEditorialFetchResult,
  ArtEditorialPageList,
  ArtEditorialPreview,
  ArtEditorialStoryList,
  ArtEditorialVenueList,
  ArtStoryListFilter,
} from "@/lib/editorial/art-editorial.types";
import {
  EditorialArtistRelationsSchema,
  EditorialExhibitionDetailSchema,
  EditorialExhibitionSummarySchema,
  EditorialHomeResponseSchema,
  EditorialPageDetailSchema,
  EditorialPageSummarySchema,
  EditorialStoryDetailSchema,
  EditorialStorySummarySchema,
  EditorialVenueDetailSchema,
  EditorialVenueSummarySchema,
} from "@auction/shop-contracts";
import { type TSchema, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

export const ExhibitionListSchema = Type.Object({
  items: Type.Array(EditorialExhibitionSummarySchema),
});
const VenueListSchema = Type.Object({ items: Type.Array(EditorialVenueSummarySchema) });
export const StoryListSchema = Type.Object({ items: Type.Array(EditorialStorySummarySchema) });
const PageListSchema = Type.Object({ items: Type.Array(EditorialPageSummarySchema) });

/** Published lists are cached briefly; drafts and slug lookups are always read fresh. */
const PUBLISHED_CACHE: RequestInit = { next: { revalidate: 120, tags: ["art:editorial"] } };
const DRAFT_CACHE: RequestInit = { cache: "no-store" };

export async function fetchEditorial<S extends TSchema>(
  path: string,
  schema: S,
  init: RequestInit = PUBLISHED_CACHE,
): Promise<ArtEditorialFetchResult<S["static"]>> {
  if (!isArtEditorialEnabled()) return { status: "disabled" };
  try {
    const response = await artCatalogueFetch(path, init);
    if (response.status === 404) return { status: "not_found" };
    if (!response.ok) return { status: "error" };
    const body: unknown = await response.json();
    if (!Value.Check(schema, body)) return { status: "error" };
    return { status: "ok", data: body as S["static"] };
  } catch {
    return { status: "error" };
  }
}

const slugPath = (prefix: string, slug: string) => `${prefix}/${encodeURIComponent(slug)}`;

export function artEditorialFeatureEnabled(): boolean {
  return isArtEditorialEnabled();
}

export function fetchEditorialHomePlacements() {
  return fetchEditorial("/v1/editorial/home", EditorialHomeResponseSchema);
}

export function fetchEditorialExhibitions(
  status: "current" | "upcoming" | "past" = "current",
): Promise<ArtEditorialFetchResult<ArtEditorialExhibitionList>> {
  return fetchEditorial(
    `/v1/editorial/exhibitions?status=${encodeURIComponent(status)}`,
    ExhibitionListSchema,
  );
}

export function fetchEditorialExhibitionBySlug(slug: string) {
  return fetchEditorial(
    slugPath("/v1/editorial/exhibitions", slug),
    EditorialExhibitionDetailSchema,
    ART_SLUG_LOOKUP,
  );
}

export function fetchEditorialStories(
  filter: ArtStoryListFilter = {},
): Promise<ArtEditorialFetchResult<ArtEditorialStoryList>> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filter)) {
    if (value) params.set(key, value);
  }
  const query = params.size > 0 ? `?${params}` : "";
  return fetchEditorial(`/v1/editorial/stories${query}`, StoryListSchema);
}

export function fetchEditorialStoryBySlug(slug: string) {
  return fetchEditorial(
    slugPath("/v1/editorial/stories", slug),
    EditorialStoryDetailSchema,
    ART_SLUG_LOOKUP,
  );
}

/** Published exhibitions and stories featuring an artist; read fresh like other slug lookups. */
export function fetchEditorialArtistRelations(
  slug: string,
): Promise<ArtEditorialFetchResult<ArtEditorialArtistRelations>> {
  return fetchEditorial(
    slugPath("/v1/editorial/artists", slug),
    EditorialArtistRelationsSchema,
    ART_SLUG_LOOKUP,
  );
}

export function fetchEditorialPages(): Promise<ArtEditorialFetchResult<ArtEditorialPageList>> {
  return fetchEditorial("/v1/editorial/pages", PageListSchema);
}

export function fetchEditorialPageBySlug(slug: string) {
  return fetchEditorial(
    slugPath("/v1/editorial/pages", slug),
    EditorialPageDetailSchema,
    ART_SLUG_LOOKUP,
  );
}

export function fetchEditorialVenues(): Promise<ArtEditorialFetchResult<ArtEditorialVenueList>> {
  return fetchEditorial("/v1/editorial/venues", VenueListSchema);
}

export function fetchEditorialVenueBySlug(slug: string) {
  return fetchEditorial(
    slugPath("/v1/editorial/venues", slug),
    EditorialVenueDetailSchema,
    ART_SLUG_LOOKUP,
  );
}

const PreviewSchema = Type.Union([
  EditorialVenueDetailSchema,
  EditorialExhibitionDetailSchema,
  EditorialStoryDetailSchema,
  EditorialPageDetailSchema,
]);

export async function fetchEditorialPreview(
  token: string,
): Promise<ArtEditorialFetchResult<ArtEditorialPreview>> {
  const result = await fetchEditorial(
    slugPath("/v1/editorial/preview", token),
    PreviewSchema,
    DRAFT_CACHE,
  );
  if (result.status !== "ok") return result;
  const entity = result.data;
  const title = "name" in entity ? entity.name : entity.title;
  const summary =
    "summary" in entity ? entity.summary : "standfirst" in entity ? entity.standfirst : null;
  const coverUrl = "coverUrl" in entity ? entity.coverUrl : null;
  return { status: "ok", data: { title, summary, coverUrl, body: entity.body } };
}

/** Base URL for editorial API (tests / diagnostics). */
export function artEditorialApiBaseUrl(): string {
  return artCatalogueApiBaseUrl();
}
