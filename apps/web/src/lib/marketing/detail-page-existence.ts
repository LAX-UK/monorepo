import "server-only";

import { registryArtistPageExists } from "@/lib/data/http/artist.server";
import { getServerLotById } from "@/lib/data/http/lots.server";
import { getServerSaleShell } from "@/lib/data/http/sales.server";
import { withdrawnLotPageExists } from "@/lib/lot-page/load-withdrawn-lot.server";
import { notFound } from "next/navigation";

/*
 * A page that does not exist must answer 404, and the status line is sent with the first byte.
 * Once a loading shell has streamed, `notFound()` can only change what the page shows. These
 * checks run in the layout of each detail route, above the route's own loading shell, so the
 * 404 is decided before anything is sent. They use the same cached reads as the page and its
 * metadata, so a real page pays for no extra request.
 *
 * `notFound()` is only for a definite "no": the API said 404 (which is also how it hides a
 * private, test or hidden item from the public). A failed read (5xx, timeout, network error,
 * malformed body) throws instead, so the route's `error.tsx` renders with a 500 and a short
 * outage never makes a real, indexed page look gone.
 */

/** A lot page exists for a lot the viewer may see, and for a withdrawn lot, which keeps its page. */
export async function requireLotPage(lotId: string): Promise<void> {
  // Throws on a failed read; null means 404 or withdrawn.
  if (await getServerLotById(lotId)) return;
  if ((await withdrawnLotPageExists(lotId)) === "exists") return;
  notFound();
}

/** A sale page exists for a sale the viewer may see; a cancelled sale keeps its address. */
export async function requireSalePage(saleId: string): Promise<void> {
  // `getServerSaleShell` returns null only for a 404 and throws on any other failure.
  if (!(await getServerSaleShell(saleId))) notFound();
}

/** An artist page exists for a registry artist, and only while the artist pages are on. */
export async function requireArtistPage(artistId: string): Promise<void> {
  if ((await registryArtistPageExists(artistId)) === "missing") notFound();
}
