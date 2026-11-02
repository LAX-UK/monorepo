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

/** The slim public row of a lot, when the lot has been withdrawn; `null` for any other lot. */
export const getServerWithdrawnLot = cache(
  async (lotId: string): Promise<WithdrawnLotPageLot | null> => {
    try {
      const client = await getServerHc();
      const res = await client.lots[":id"].$get({ param: { id: lotId } });
      if (!res.ok) return null;
      const body = await readJsonBody(res);
      return parseWithdrawnLot(isIndexableObject(body) ? body.data : null);
    } catch {
      return null;
    }
  },
);

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
