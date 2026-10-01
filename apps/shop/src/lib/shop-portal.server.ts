import { shopCommerceRequest } from "@/lib/shop-commerce-request.server";

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

export async function fetchPortalEditions(): Promise<
  { ok: true; items: PortalEditionItem[] } | { ok: false; status: number; unavailable?: boolean }
> {
  const response = await shopCommerceRequest("/commerce/me/editions");
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      unavailable: response.status === 404,
    };
  }
  const data = (await response.json()) as { items?: PortalEditionItem[] };
  return { ok: true, items: data.items ?? [] };
}

export async function fetchPortalSaleAuthority(): Promise<
  | { ok: true; items: PortalSaleAuthorityItem[] }
  | { ok: false; status: number; unavailable?: boolean }
> {
  const response = await shopCommerceRequest("/commerce/me/sale-authority");
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      unavailable: response.status === 404,
    };
  }
  const data = (await response.json()) as { items?: PortalSaleAuthorityItem[] };
  return { ok: true, items: data.items ?? [] };
}
