import { shopCommerceRequest } from "@/lib/shop-commerce-request.server";
import type { ShopPortalFetchResult } from "@/lib/shop-fetch-result";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";

export type PortalEditionItem = {
  editionId: string;
  artworkId: string;
  artworkSlug: string;
  artworkTitle: string;
  editionNumber: number;
  listingStatus: string;
  custodyStatus: string;
};

export type PortalSaleAuthorityItem = {
  artworkId: string;
  artworkSlug: string;
  artworkTitle: string;
  ownerPartyId: string;
  authorisedCount: number;
  committedCount: number;
  lastGrantAt: string | null;
};

function readUpstreamErrorCode(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const record = body as { code?: string; error?: string };
  if (typeof record.code === "string") return record.code;
  if (record.error === "commerce_upstream_failed" && typeof record.code === "string") {
    return record.code;
  }
  return undefined;
}

function isPortalOwnershipDisabled(response: Response, body: unknown): boolean {
  if (response.status === 404) return true;
  const code = readUpstreamErrorCode(body);
  return code === SHOP_API_ERROR_CODES.FEATURE_DISABLED || code === SHOP_API_ERROR_CODES.NOT_FOUND;
}

function parsePortalEditionItems(body: unknown): PortalEditionItem[] | null {
  if (!body || typeof body !== "object" || !("items" in body)) return null;
  const items = (body as { items?: unknown }).items;
  if (!Array.isArray(items)) return null;
  for (const row of items) {
    if (!row || typeof row !== "object") return null;
    const edition = row as Record<string, unknown>;
    if (
      typeof edition.editionId !== "string" ||
      typeof edition.artworkId !== "string" ||
      typeof edition.artworkSlug !== "string" ||
      typeof edition.artworkTitle !== "string" ||
      typeof edition.editionNumber !== "number" ||
      typeof edition.listingStatus !== "string" ||
      typeof edition.custodyStatus !== "string"
    ) {
      return null;
    }
  }
  return items as PortalEditionItem[];
}

function parsePortalSaleAuthorityItems(body: unknown): PortalSaleAuthorityItem[] | null {
  if (!body || typeof body !== "object" || !("items" in body)) return null;
  const items = (body as { items?: unknown }).items;
  if (!Array.isArray(items)) return null;
  for (const row of items) {
    if (!row || typeof row !== "object") return null;
    const authority = row as Record<string, unknown>;
    if (
      typeof authority.artworkId !== "string" ||
      typeof authority.artworkSlug !== "string" ||
      typeof authority.artworkTitle !== "string" ||
      typeof authority.ownerPartyId !== "string" ||
      typeof authority.authorisedCount !== "number" ||
      typeof authority.committedCount !== "number" ||
      (authority.lastGrantAt !== null && typeof authority.lastGrantAt !== "string")
    ) {
      return null;
    }
  }
  return items as PortalSaleAuthorityItem[];
}

async function fetchPortalList<T>(
  path: string,
  parseItems: (body: unknown) => T[] | null,
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
      if (isPortalOwnershipDisabled(response, body)) {
        return { status: "commerce_unavailable" };
      }
      return { status: "failed" };
    }
    const items = parseItems(body);
    if (items === null) return { status: "failed" };
    if (items.length === 0) return { status: "empty" };
    return { status: "ok", data: items };
  } catch {
    return { status: "failed" };
  }
}

export async function fetchPortalEditions(): Promise<ShopPortalFetchResult<PortalEditionItem[]>> {
  return fetchPortalList("/commerce/me/editions", parsePortalEditionItems);
}

export async function fetchPortalSaleAuthority(): Promise<
  ShopPortalFetchResult<PortalSaleAuthorityItem[]>
> {
  return fetchPortalList("/commerce/me/sale-authority", parsePortalSaleAuthorityItems);
}
