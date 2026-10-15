import { loadArtEnv } from "@/env.server";
import { ArtApiBffError } from "@/lib/art-api-bff-error";
import type { ArtArtistListQuery, ArtArtworkListQuery } from "@/lib/ports";
import {
  type PublicArtistDetail,
  type PublicArtistList,
  type PublicArtworkDetail,
  type PublicArtworkList,
  type PublicArtworkObjectTypeFacetList,
  type PublicCategoryList,
  ShopContractParseError,
  parsePublicArtistDetail,
  parsePublicArtistList,
  parsePublicArtworkDetail,
  parsePublicArtworkList,
  parsePublicArtworkObjectTypeFacets,
  parsePublicCategoryList,
} from "@auction/shop-contracts";

const DEFAULT_SHOP_API_BASE_URL = "http://localhost:3011";
const ART_FETCH_TIMEOUT_MS = 2500;
const ART_HOME_REVALIDATE_SECONDS = 300;
const ART_SALES_CHANNEL = "art" as const;

export function artCatalogueApiBaseUrl(): string {
  const configured = loadArtEnv().SHOP_API_BASE_URL;
  return (configured && configured.length > 0 ? configured : DEFAULT_SHOP_API_BASE_URL).replace(
    /\/+$/,
    "",
  );
}

export function artCatalogueApiServerUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${artCatalogueApiBaseUrl()}${normalized}`;
}

/**
 * Next only writes 200s to the data cache, so a cached slug lookup keeps serving after the
 * entity is deleted (the 404 never replaces it). Slug lookups bypass the cache.
 */
export const ART_SLUG_LOOKUP: RequestInit = { cache: "no-store" };

export async function artCatalogueFetch(path: string, init?: RequestInit): Promise<Response> {
  const resource = path.split(/[/?]/).filter(Boolean)[1] ?? "catalogue";
  const url = `${artCatalogueApiBaseUrl()}${path}`;
  const signal = AbortSignal.timeout(ART_FETCH_TIMEOUT_MS);
  if (init?.cache === "no-store") {
    return fetch(url, { ...init, signal });
  }
  return fetch(url, {
    ...init,
    signal,
    next: {
      revalidate: ART_HOME_REVALIDATE_SECONDS,
      tags: ["art:catalogue", `art:${resource}`],
      ...(init?.next ?? {}),
    },
  });
}

async function readValidatedJson<T>(
  response: Response,
  parse: (value: unknown) => T,
  context: string,
): Promise<T> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ArtApiBffError("malformed", `${context}: response was not JSON`);
  }
  try {
    return parse(body);
  } catch (error) {
    if (error instanceof ShopContractParseError) {
      throw new ArtApiBffError("malformed", `${context}: ${error.message}`);
    }
    throw error;
  }
}

export async function fetchArtChannelArtworks(
  input: ArtArtworkListQuery,
): Promise<PublicArtworkList> {
  const params = new URLSearchParams();
  params.set("limit", String(input.limit ?? 24));
  params.set("salesChannel", ART_SALES_CHANNEL);
  if (input.cursor) params.set("cursor", input.cursor);
  if (input.placement) params.set("placement", input.placement);
  if (input.categorySlug) params.set("categorySlug", input.categorySlug);
  if (input.artistSlug) params.set("artistSlug", input.artistSlug);
  if (input.editionEligible !== undefined) {
    params.set("editionEligible", String(input.editionEligible));
  }
  if (input.type && input.type !== "all") params.set("type", input.type);
  if (input.objectType) params.set("objectType", input.objectType);
  if (input.rarity) params.set("rarity", input.rarity);
  if (input.relatedTo) params.set("relatedTo", input.relatedTo);
  if (input.minPrice !== undefined) params.set("minPrice", String(input.minPrice));
  if (input.maxPrice !== undefined) params.set("maxPrice", String(input.maxPrice));
  if (input.sort && input.sort !== "newest") params.set("sort", input.sort);
  if (input.saleState) params.set("saleState", input.saleState);
  if (input.q) params.set("q", input.q);
  const response = await artCatalogueFetch(`/v1/artworks?${params.toString()}`);
  if (!response.ok) {
    throw new ArtApiBffError("upstream", `Art catalogue request failed (${response.status})`);
  }
  return readValidatedJson(response, parsePublicArtworkList, "artwork list");
}

export async function fetchArtChannelArtworkBySlug(
  slug: string,
): Promise<PublicArtworkDetail | null> {
  const response = await artCatalogueFetch(
    `/v1/artworks/${encodeURIComponent(slug)}?salesChannel=${ART_SALES_CHANNEL}`,
    ART_SLUG_LOOKUP,
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new ArtApiBffError("upstream", `Art artwork request failed (${response.status})`);
  }
  return readValidatedJson(response, parsePublicArtworkDetail, "artwork detail");
}

export async function fetchArtChannelArtworkObjectTypes(): Promise<PublicArtworkObjectTypeFacetList> {
  const response = await artCatalogueFetch(
    `/v1/artwork-object-types?salesChannel=${ART_SALES_CHANNEL}`,
  );
  if (!response.ok) {
    throw new ArtApiBffError("upstream", `Art object types request failed (${response.status})`);
  }
  return readValidatedJson(response, parsePublicArtworkObjectTypeFacets, "artwork object types");
}

export async function fetchArtChannelCategories(input?: {
  limit?: number;
  placement?: "featured_categories";
}): Promise<PublicCategoryList> {
  const params = new URLSearchParams();
  params.set("limit", String(input?.limit ?? 50));
  if (input?.placement) params.set("placement", input.placement);
  const query = params.size > 0 ? `?${params.toString()}` : "";
  const response = await artCatalogueFetch(`/v1/categories${query}`);
  if (!response.ok) {
    throw new ArtApiBffError("upstream", `Art categories request failed (${response.status})`);
  }
  return readValidatedJson(response, parsePublicCategoryList, "category list");
}

export async function fetchArtChannelArtists(input: ArtArtistListQuery): Promise<PublicArtistList> {
  const params = new URLSearchParams();
  params.set("limit", String(input.limit ?? 24));
  params.set("salesChannel", ART_SALES_CHANNEL);
  if (input.cursor) params.set("cursor", input.cursor);
  if (input.placement) params.set("placement", input.placement);
  if (input.q) params.set("q", input.q);
  if (input.sort) params.set("sort", input.sort);
  if (input.letter) params.set("letter", input.letter);
  const response = await artCatalogueFetch(`/v1/artists?${params.toString()}`);
  if (!response.ok) {
    throw new ArtApiBffError("upstream", `Art artists request failed (${response.status})`);
  }
  return readValidatedJson(response, parsePublicArtistList, "artist list");
}

export async function fetchArtChannelArtistBySlug(
  slug: string,
): Promise<PublicArtistDetail | null> {
  const response = await artCatalogueFetch(
    `/v1/artists/${encodeURIComponent(slug)}`,
    ART_SLUG_LOOKUP,
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new ArtApiBffError("upstream", `Art artist request failed (${response.status})`);
  }
  return readValidatedJson(response, parsePublicArtistDetail, "artist detail");
}
