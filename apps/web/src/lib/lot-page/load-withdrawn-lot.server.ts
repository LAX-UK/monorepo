import "server-only";

import { publicLotTag } from "@/lib/data/cache-tags";
import { fetchRegistryArtistById } from "@/lib/data/http/artist-profile-public";
import { readJsonBody } from "@/lib/data/http/envelope";
import { isIndexableObject } from "@/lib/data/http/object-guards";
import {
  PUBLIC_PAGE_REVALIDATE_SECONDS,
  getPublicSaleWithLots,
} from "@/lib/data/http/public-catalogue.server";
import { getServerApiBase } from "@/lib/data/http/server-api-base";
import { artistLifespan } from "@/lib/lot-page/artist-lifespan";
import { type WithdrawnLotPageLot, parseWithdrawnLot } from "@/lib/lot-page/withdrawn-lot";
import { ensureCanonicalLotSlug } from "@/lib/marketing/lot-canonical-slug";
import { artistPath, salePath } from "@/lib/seo/url";
import { cache } from "react";

export type WithdrawnLotPageData = {
  lot: WithdrawnLotPageLot;
  artist: { id: string; name: string; href: string; lifespan: string | null } | null;
  sale: { href: string; label: string; title: string | null };
};

type WithdrawnLotRead =
  | { kind: "withdrawn"; lot: WithdrawnLotPageLot }
  | { kind: "other" }
  | { kind: "missing" }
  | { kind: "failed"; error: unknown };

/**
 * One cached read of the lot row, keeping a definite 404 apart from a failed read. Session-free
 * and tagged like the lot page's own read (the same request, so one fetch serves both, CO-7).
 */
const readWithdrawnLot = cache(async (lotId: string): Promise<WithdrawnLotRead> => {
  try {
    const res = await fetch(`${getServerApiBase()}/lots/${encodeURIComponent(lotId)}`, {
      next: { revalidate: PUBLIC_PAGE_REVALIDATE_SECONDS, tags: [publicLotTag(lotId)] },
    });
    if (res.status === 404) return { kind: "missing" };
    if (!res.ok) return { kind: "failed", error: new Error(`Failed to load lot: ${res.status}`) };
    const body = await readJsonBody(res);
    const lot = parseWithdrawnLot(isIndexableObject(body) ? body.data : null);
    return lot ? { kind: "withdrawn", lot } : { kind: "other" };
  } catch (error) {
    return { kind: "failed", error };
  }
});

/** The slim public row of a lot, when the lot has been withdrawn; `null` for any other lot. */
export const getServerWithdrawnLot = cache(
  async (lotId: string): Promise<WithdrawnLotPageLot | null> => {
    const read = await readWithdrawnLot(lotId);
    return read.kind === "withdrawn" ? read.lot : null;
  },
);

/**
 * For a lot the public reader returned nothing for: is it withdrawn (keeps its page), definitely
 * missing (404), or unknown because the read failed? Throws on a failure, never answers
 * "missing" for one.
 */
export async function withdrawnLotPageExists(lotId: string): Promise<"exists" | "missing"> {
  const read = await readWithdrawnLot(lotId);
  if (read.kind === "failed") throw read.error;
  return read.kind === "withdrawn" ? "exists" : "missing";
}

/**
 * What the withdrawn lot page needs: the lot, its artist and the sale to go back to. Returns
 * `null` for a lot that has not been withdrawn, so the page takes its usual path.
 */
export async function loadWithdrawnLotPage(input: {
  id: string;
  slug: string;
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<WithdrawnLotPageData | null> {
  const lot = await getServerWithdrawnLot(input.id);
  if (!lot) return null;
  ensureCanonicalLotSlug(input.slug, lot, input.searchParams);
  const [artist, sale] = await Promise.all([
    lot.artistId ? fetchRegistryArtistById(lot.artistId).catch(() => null) : null,
    lot.saleId ? getPublicSaleWithLots(lot.saleId).catch(() => null) : null,
  ]);
  return {
    lot,
    artist: artist
      ? {
          id: artist.id,
          name: artist.displayName,
          href: artistPath({ id: artist.id, name: artist.displayName }),
          lifespan: artistLifespan(artist.birthYear, artist.deathYear),
        }
      : null,
    sale: sale
      ? { href: salePath(sale.sale), label: "Back to the sale", title: sale.sale.title }
      : { href: "/search", label: "Search lots", title: null },
  };
}
