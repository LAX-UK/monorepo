"use server";

import {
  type LookupOption,
  artworkOption,
  editionOption,
  partyOption,
} from "@/server/domain/lookup-options.vm";
import {
  ADMIN_LOOKUP_SEARCH_MAX_LENGTH,
  type AdminArtworkLookupItem,
  type AdminEditionLookupItem,
  type AdminPartyLookupItem,
} from "@auction/shop-contracts";
import { fetchAdminJson } from "./load-admin-data";

function lookupPath(kind: "parties" | "artworks" | "editions", query: string): string {
  const params = new URLSearchParams({ limit: "15" });
  const q = query.trim().slice(0, ADMIN_LOOKUP_SEARCH_MAX_LENGTH);
  if (q) params.set("q", q);
  return `lookups/${kind}?${params.toString()}`;
}

/** People matching a name or email, for the pickers that choose an owner, buyer, seller or client. */
export async function searchPartyOptions(query: string): Promise<LookupOption[]> {
  const result = await fetchAdminJson<{ items: AdminPartyLookupItem[] }>(
    lookupPath("parties", query),
  );
  return result.status === "ok" ? result.data.items.map(partyOption) : [];
}

/** Artworks matching a title or artist name. */
export async function searchArtworkOptions(query: string): Promise<LookupOption[]> {
  const result = await fetchAdminJson<{ items: AdminArtworkLookupItem[] }>(
    lookupPath("artworks", query),
  );
  return result.status === "ok" ? result.data.items.map(artworkOption) : [];
}

/** Editions matching an artwork title or artist name. */
export async function searchEditionOptions(query: string): Promise<LookupOption[]> {
  const result = await fetchAdminJson<{ items: AdminEditionLookupItem[] }>(
    lookupPath("editions", query),
  );
  return result.status === "ok" ? result.data.items.map(editionOption) : [];
}
