import "server-only";

import { fetchRegistryArtistById } from "@/lib/data/http/artist.server";
import { readJsonBody } from "@/lib/data/http/envelope";
import { getServerHc } from "@/lib/data/http/hc-server";
import { isIndexableObject } from "@/lib/data/http/object-guards";
import { getServerSaleWithLots } from "@/lib/data/http/sales.server";
import { artistLifespan } from "@/lib/lot-page/artist-lifespan";
import { type WithdrawnLotPageLot, parseWithdrawnLot } from "@/lib/lot-page/withdrawn-lot";
import { ensureCanonicalLotSlug } from "@/lib/marketing/load-lot-detail-page";
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

/** One cached read of the lot row, keeping a definite 404 apart from a failed read. */
const readWithdrawnLot = cache(async (lotId: string): Promise<WithdrawnLotRead> => {
  try {
    const client = await getServerHc();
    const res = await client.lots[":id"].$get({ param: { id: lotId } });
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
    lot.saleId ? getServerSaleWithLots(lot.saleId).catch(() => null) : null,
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
