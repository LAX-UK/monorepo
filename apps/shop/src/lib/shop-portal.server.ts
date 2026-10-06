import { shopApiServerUrl } from "@/lib/shop-api.server";
import { shopCommerceRequest } from "@/lib/shop-commerce-request.server";
import type { ShopPortalFetchResult } from "@/lib/shop-fetch-result";
import {
  type PortalDocument,
  type PortalEdition,
  type PortalPayout,
  type PortalSaleAuthority,
  type PortalSaleAuthorityRequest,
  type PortalSaleStatement,
  SHOP_API_ERROR_CODES,
  ShopContractParseError,
  parsePortalArtistArtworks,
  parsePortalArtistSales,
  parsePortalDocuments,
  parsePortalEditions,
  parsePortalPayouts,
  parsePortalSaleAuthority,
  parsePortalSaleAuthorityRequests,
  parsePortalSales,
} from "@auction/shop-contracts";
import { cache } from "react";

const PORTAL_OWNERSHIP_PROBE_TIMEOUT_MS = 2500;

export type PortalEditionItem = PortalEdition;
export type PortalSaleAuthorityItem = PortalSaleAuthority;
export type PortalPayoutItem = PortalPayout;
export type PortalDocumentItem = PortalDocument;
export type PortalSaleAuthorityRequestItem = PortalSaleAuthorityRequest;
export type PortalSaleStatementItem = PortalSaleStatement;

function readUpstreamErrorCode(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const record = body as { code?: string; error?: string };
  if (typeof record.code === "string") return record.code;
  if (record.error === "commerce_upstream_failed" && typeof record.code === "string") {
    return record.code;
  }
  return undefined;
}

function isPortalFeatureDisabled(body: unknown): boolean {
  return readUpstreamErrorCode(body) === SHOP_API_ERROR_CODES.FEATURE_DISABLED;
}

/** Storefront hub links follow shop-api when the storefront env flag is unset. */
export const resolveShopPortalOwnershipEnabled = cache(async (): Promise<boolean> => {
  const envFlag = process.env.SHOP_PORTAL_OWNERSHIP_ENABLED?.trim();
  if (envFlag === "true") return true;
  if (envFlag === "false") return false;

  try {
    const response = await fetch(shopApiServerUrl("/v1/me/editions"), {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(PORTAL_OWNERSHIP_PROBE_TIMEOUT_MS),
    });
    if (response.status === 401) return true;
    if (response.status === 404) {
      const body = await response.json().catch(() => null);
      if (isPortalFeatureDisabled(body)) {
        return false;
      }
    }
  } catch {
    // Conservative default when shop-api is unreachable.
  }
  return false;
});

async function fetchPortalList<T>(
  path: string,
  parseItems: (body: unknown) => T[],
): Promise<ShopPortalFetchResult<T[]>> {
  try {
    const response = await shopCommerceRequest(path, {
      headers: { accept: "application/json" },
    });
    if (response.status === 401) return { status: "unauthorized" };
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { status: "failed" };
    }
    if (!response.ok) {
      if (isPortalFeatureDisabled(body)) {
        return { status: "commerce_unavailable" };
      }
      return { status: "failed" };
    }
    try {
      const items = parseItems(body);
      if (items.length === 0) return { status: "empty" };
      return { status: "ok", data: items };
    } catch (error) {
      if (error instanceof ShopContractParseError) {
        return { status: "failed" };
      }
      throw error;
    }
  } catch {
    return { status: "failed" };
  }
}

export async function fetchPortalEditions(): Promise<ShopPortalFetchResult<PortalEditionItem[]>> {
  return fetchPortalList("/commerce/me/editions", parsePortalEditions);
}

export async function fetchPortalSaleAuthority(): Promise<
  ShopPortalFetchResult<PortalSaleAuthorityItem[]>
> {
  return fetchPortalList("/commerce/me/sale-authority", parsePortalSaleAuthority);
}

export async function fetchPortalSaleAuthorityRequests(): Promise<
  ShopPortalFetchResult<PortalSaleAuthorityRequestItem[]>
> {
  return fetchPortalList("/commerce/me/sale-authority-requests", parsePortalSaleAuthorityRequests);
}

export async function fetchPortalPayouts(): Promise<ShopPortalFetchResult<PortalPayoutItem[]>> {
  return fetchPortalList("/commerce/me/payouts", parsePortalPayouts);
}

export async function fetchPortalSales(): Promise<
  ShopPortalFetchResult<PortalSaleStatementItem[]>
> {
  return fetchPortalList("/commerce/me/sales", parsePortalSales);
}

export async function fetchPortalDocuments(): Promise<ShopPortalFetchResult<PortalDocumentItem[]>> {
  return fetchPortalList("/commerce/me/documents", parsePortalDocuments);
}

async function fetchPortalArtistPayload<T>(
  path: string,
  parse: (body: unknown) => T,
): Promise<ShopPortalFetchResult<T>> {
  try {
    const response = await shopCommerceRequest(path, {
      headers: { accept: "application/json" },
    });
    if (response.status === 401) return { status: "unauthorized" };
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      if (isPortalFeatureDisabled(body)) {
        return { status: "commerce_unavailable" };
      }
      return { status: "failed" };
    }
    return { status: "ok", data: parse(body) };
  } catch {
    return { status: "failed" };
  }
}

export async function fetchPortalArtistArtworks() {
  return fetchPortalArtistPayload("/commerce/me/artist/artworks", parsePortalArtistArtworks);
}

export async function fetchPortalArtistSales() {
  return fetchPortalArtistPayload("/commerce/me/artist/sales", parsePortalArtistSales);
}

/** Whether the signed-in subject is linked to an artist profile (for account nav). */
export const resolveShopArtistPortalLinked = cache(async (): Promise<boolean> => {
  const result = await fetchPortalArtistArtworks();
  if (result.status === "ok") return result.data.artist != null;
  return false;
});
