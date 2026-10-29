import { loadShopEnv } from "@/env";
import { ShopApiBffError } from "@/lib/shop-api-bff-error";
import {
  type PublicArtistDetail,
  type PublicArtistList,
  type PublicArtistSort,
  type PublicArtworkDetail,
  type PublicArtworkFacetCounts,
  type PublicArtworkList,
  type PublicCategoryList,
  type PublicCategorySummary,
  type PublicMerchandiseProductDetail,
  type PublicMerchandiseProductList,
  ShopContractParseError,
  parsePublicArtistDetail,
  parsePublicArtistList,
  parsePublicArtworkDetail,
  parsePublicArtworkFacetCounts,
  parsePublicArtworkList,
  parsePublicCategoryList,
  parsePublicCategorySummary,
  parsePublicMerchandiseProductDetail,
  parsePublicMerchandiseProductList,
} from "@auction/shop-contracts";

const DEFAULT_SHOP_API_BASE_URL = "http://localhost:3011";
const SHOP_FETCH_TIMEOUT_MS = 2500;
const SHOP_HOME_REVALIDATE_SECONDS = 300;

export function shopApiBaseUrl(): string {
  const configured = loadShopEnv().SHOP_API_BASE_URL;
  return (configured && configured.length > 0 ? configured : DEFAULT_SHOP_API_BASE_URL).replace(
    /\/+$/,
    "",
  );
}

export function shopApiServerUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${shopApiBaseUrl()}${normalized}`;
}

/**
 * Next only writes 200s to the data cache, so a cached slug lookup keeps serving after the
 * entity is deleted (the 404 never replaces it). Slug lookups bypass the cache.
 */
const SLUG_LOOKUP: RequestInit = { cache: "no-store" };

async function shopApiFetch(path: string, init?: RequestInit): Promise<Response> {
  const resource = path.split(/[/?]/).filter(Boolean)[1] ?? "catalogue";
  const url = `${shopApiBaseUrl()}${path}`;
  const signal = AbortSignal.timeout(SHOP_FETCH_TIMEOUT_MS);
  if (init?.cache === "no-store") {
    return fetch(url, { ...init, signal });
  }
  return fetch(url, {
    ...init,
    signal,
    next: {
      revalidate: SHOP_HOME_REVALIDATE_SECONDS,
      tags: ["shop:catalogue", `shop:${resource}`],
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
    throw new ShopApiBffError("malformed", `${context}: response was not JSON`);
  }
  try {
    return parse(body);
  } catch (error) {
    if (error instanceof ShopContractParseError) {
      throw new ShopApiBffError("malformed", `${context}: ${error.message}`);
    }
    throw error;
  }
}

export async function fetchPublicArtworks(input: {
  limit?: number;
  cursor?: string;
  placement?: "featured_prints";
  categorySlug?: string;
  artistSlug?: string;
  saleState?: "for_sale" | "sold";
  availability?: "available" | "sold_out";
  minPrice?: number;
  maxPrice?: number;
  size?: "small" | "medium" | "large";
  technique?: string;
  sort?: "newest" | "titleAsc" | "priceAsc" | "priceDesc";
  q?: string;
}): Promise<PublicArtworkList> {
  const params = catalogueFilterParams(input);
  params.set("limit", String(input.limit ?? 24));
  if (input.cursor) params.set("cursor", input.cursor);
  if (input.placement) params.set("placement", input.placement);
  if (input.sort && input.sort !== "newest") params.set("sort", input.sort);
  const response = await shopApiFetch(`/v1/artworks?${params.toString()}`);
  if (!response.ok) {
    throw new ShopApiBffError("upstream", `Shop catalogue request failed (${response.status})`);
  }
  return readValidatedJson(response, parsePublicArtworkList, "artwork list");
}

type CatalogueFilterInput = {
  categorySlug?: string;
  artistSlug?: string;
  saleState?: "for_sale" | "sold";
  availability?: "available" | "sold_out";
  minPrice?: number;
  maxPrice?: number;
  size?: "small" | "medium" | "large";
  technique?: string;
  q?: string;
};

/** Shop-channel filter params, shared by the list and its filter counts. */
function catalogueFilterParams(input: CatalogueFilterInput): URLSearchParams {
  const params = new URLSearchParams();
  params.set("salesChannel", "shop");
  if (input.categorySlug) params.set("categorySlug", input.categorySlug);
  if (input.artistSlug) params.set("artistSlug", input.artistSlug);
  if (input.minPrice !== undefined) params.set("minPrice", String(input.minPrice));
  if (input.maxPrice !== undefined) params.set("maxPrice", String(input.maxPrice));
  if (input.saleState) params.set("saleState", input.saleState);
  if (input.availability) params.set("availability", input.availability);
  if (input.size) params.set("size", input.size);
  if (input.technique) params.set("technique", input.technique);
  if (input.q) params.set("q", input.q);
  return params;
}

/** Counts beside each catalogue filter option, for the same filters as the list. */
export async function fetchPublicArtworkFacets(
  input: CatalogueFilterInput,
): Promise<PublicArtworkFacetCounts> {
  const response = await shopApiFetch(`/v1/artwork-facets?${catalogueFilterParams(input)}`);
  if (!response.ok) {
    throw new ShopApiBffError("upstream", `Shop facet request failed (${response.status})`);
  }
  return readValidatedJson(response, parsePublicArtworkFacetCounts, "artwork facets");
}

/** @deprecated Prefer fetchPublicArtworks for filtered home sections. */
export async function fetchPublicArtworkCatalogue(): Promise<PublicArtworkList> {
  return fetchPublicArtworks({ limit: 24 });
}

/**
 * Looks an artwork up in one sales channel. The Shop channel only ever returns limited editions;
 * the `art` channel is used to recognise an original that now lives on lax.art.
 */
export async function fetchPublicArtworkBySlug(
  slug: string,
  salesChannel: "shop" | "art" = "shop",
): Promise<PublicArtworkDetail | null> {
  const response = await shopApiFetch(
    `/v1/artworks/${encodeURIComponent(slug)}?salesChannel=${salesChannel}`,
    SLUG_LOOKUP,
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new ShopApiBffError("upstream", `Shop artwork request failed (${response.status})`);
  }
  return readValidatedJson(response, parsePublicArtworkDetail, "artwork detail");
}

export async function fetchPublicCategories(input?: {
  limit?: number;
  placement?: "featured_categories";
}): Promise<PublicCategoryList> {
  const params = new URLSearchParams();
  params.set("limit", String(input?.limit ?? 50));
  // Only categories that hold a live Shop edition, so retired or originals-only categories drop out.
  params.set("salesChannel", "shop");
  if (input?.placement) params.set("placement", input.placement);
  const response = await shopApiFetch(`/v1/categories?${params.toString()}`);
  if (!response.ok) {
    throw new ShopApiBffError("upstream", `Shop categories request failed (${response.status})`);
  }
  return readValidatedJson(response, parsePublicCategoryList, "category list");
}

export async function fetchPublicCategoryBySlug(
  slug: string,
): Promise<PublicCategorySummary | null> {
  const response = await shopApiFetch(`/v1/categories/${encodeURIComponent(slug)}`, SLUG_LOOKUP);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new ShopApiBffError("upstream", `Shop category request failed (${response.status})`);
  }
  return readValidatedJson(response, parsePublicCategorySummary, "category detail");
}

/** Artists with editions in the Shop; artists with only originals live on lax.art. */
export async function fetchPublicArtists(input: {
  limit?: number;
  cursor?: string;
  placement?: "featured_artists";
  q?: string;
  letter?: string;
  sort?: PublicArtistSort;
  /** Only artists with an edition on sale now. */
  hasAvailableEditions?: boolean;
}): Promise<PublicArtistList> {
  const params = new URLSearchParams();
  params.set("limit", String(input.limit ?? 24));
  params.set("salesChannel", "shop");
  if (input.cursor) params.set("cursor", input.cursor);
  if (input.placement) params.set("placement", input.placement);
  if (input.q) params.set("q", input.q);
  if (input.letter) params.set("letter", input.letter);
  if (input.sort) params.set("sort", input.sort);
  if (input.hasAvailableEditions) params.set("hasAvailableEditions", "true");
  const response = await shopApiFetch(`/v1/artists?${params.toString()}`);
  if (!response.ok) {
    throw new ShopApiBffError("upstream", `Shop artists request failed (${response.status})`);
  }
  return readValidatedJson(response, parsePublicArtistList, "artist list");
}

export async function fetchPublicArtistBySlug(slug: string): Promise<PublicArtistDetail | null> {
  const response = await shopApiFetch(`/v1/artists/${encodeURIComponent(slug)}`, SLUG_LOOKUP);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new ShopApiBffError("upstream", `Shop artist request failed (${response.status})`);
  }
  return readValidatedJson(response, parsePublicArtistDetail, "artist detail");
}

export async function fetchPublicMerchandiseProducts(): Promise<PublicMerchandiseProductList> {
  const response = await shopApiFetch("/v1/merchandise/products");
  if (response.status === 404) {
    return { items: [] };
  }
  if (!response.ok) {
    throw new ShopApiBffError("upstream", `Shop merchandise request failed (${response.status})`);
  }
  return readValidatedJson(response, parsePublicMerchandiseProductList, "merchandise list");
}

export async function fetchPublicMerchandiseProduct(
  slug: string,
): Promise<PublicMerchandiseProductDetail | null> {
  const response = await shopApiFetch(
    `/v1/merchandise/products/${encodeURIComponent(slug)}`,
    SLUG_LOOKUP,
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new ShopApiBffError("upstream", `Shop merchandise request failed (${response.status})`);
  }
  return readValidatedJson(response, parsePublicMerchandiseProductDetail, "merchandise detail");
}
