import { loadShopEnv } from "@/env";
import { ShopApiBffError } from "@/lib/shop-api-bff-error";
import {
  type PublicArtistDetail,
  type PublicArtistList,
  type PublicArtworkDetail,
  type PublicArtworkList,
  type PublicCategoryList,
  type PublicCategorySummary,
  ShopContractParseError,
  parsePublicArtistDetail,
  parsePublicArtistList,
  parsePublicArtworkDetail,
  parsePublicArtworkList,
  parsePublicCategoryList,
  parsePublicCategorySummary,
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

async function shopApiFetch(path: string, init?: RequestInit): Promise<Response> {
  const resource = path.split(/[/?]/).filter(Boolean)[1] ?? "catalogue";
  return fetch(`${shopApiBaseUrl()}${path}`, {
    ...init,
    signal: AbortSignal.timeout(SHOP_FETCH_TIMEOUT_MS),
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
  placement?: "featured_originals" | "featured_prints";
  categorySlug?: string;
  artistSlug?: string;
  saleState?: "for_sale" | "price_on_application" | "sold";
  editionEligible?: boolean;
  type?: "all" | "original" | "edition";
  minPrice?: number;
  maxPrice?: number;
  sort?: "newest" | "titleAsc" | "priceAsc" | "priceDesc";
  q?: string;
}): Promise<PublicArtworkList> {
  const params = new URLSearchParams();
  params.set("limit", String(input.limit ?? 24));
  if (input.cursor) params.set("cursor", input.cursor);
  if (input.placement) params.set("placement", input.placement);
  if (input.categorySlug) params.set("categorySlug", input.categorySlug);
  if (input.artistSlug) params.set("artistSlug", input.artistSlug);
  if (input.editionEligible !== undefined) {
    params.set("editionEligible", String(input.editionEligible));
  }
  if (input.type && input.type !== "all") params.set("type", input.type);
  if (input.minPrice !== undefined) params.set("minPrice", String(input.minPrice));
  if (input.maxPrice !== undefined) params.set("maxPrice", String(input.maxPrice));
  if (input.sort && input.sort !== "newest") params.set("sort", input.sort);
  if (input.saleState) params.set("saleState", input.saleState);
  if (input.q) params.set("q", input.q);
  const response = await shopApiFetch(`/v1/artworks?${params.toString()}`);
  if (!response.ok) {
    throw new ShopApiBffError("upstream", `Shop catalogue request failed (${response.status})`);
  }
  return readValidatedJson(response, parsePublicArtworkList, "artwork list");
}

/** @deprecated Prefer fetchPublicArtworks for filtered home sections. */
export async function fetchPublicArtworkCatalogue(): Promise<PublicArtworkList> {
  return fetchPublicArtworks({ limit: 24 });
}

export async function fetchPublicArtworkBySlug(slug: string): Promise<PublicArtworkDetail | null> {
  const response = await shopApiFetch(`/v1/artworks/${encodeURIComponent(slug)}`);
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
  if (input?.placement) params.set("placement", input.placement);
  const query = params.size > 0 ? `?${params.toString()}` : "";
  const response = await shopApiFetch(`/v1/categories${query}`);
  if (!response.ok) {
    throw new ShopApiBffError("upstream", `Shop categories request failed (${response.status})`);
  }
  return readValidatedJson(response, parsePublicCategoryList, "category list");
}

export async function fetchPublicCategoryBySlug(
  slug: string,
): Promise<PublicCategorySummary | null> {
  const response = await shopApiFetch(`/v1/categories/${encodeURIComponent(slug)}`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new ShopApiBffError("upstream", `Shop category request failed (${response.status})`);
  }
  return readValidatedJson(response, parsePublicCategorySummary, "category detail");
}

export async function fetchPublicArtists(input: {
  limit?: number;
  cursor?: string;
  placement?: "featured_artists";
}): Promise<PublicArtistList> {
  const params = new URLSearchParams();
  params.set("limit", String(input.limit ?? 24));
  if (input.cursor) params.set("cursor", input.cursor);
  if (input.placement) params.set("placement", input.placement);
  const response = await shopApiFetch(`/v1/artists?${params.toString()}`);
  if (!response.ok) {
    throw new ShopApiBffError("upstream", `Shop artists request failed (${response.status})`);
  }
  return readValidatedJson(response, parsePublicArtistList, "artist list");
}

export async function fetchPublicArtistBySlug(slug: string): Promise<PublicArtistDetail | null> {
  const response = await shopApiFetch(`/v1/artists/${encodeURIComponent(slug)}`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new ShopApiBffError("upstream", `Shop artist request failed (${response.status})`);
  }
  return readValidatedJson(response, parsePublicArtistDetail, "artist detail");
}
