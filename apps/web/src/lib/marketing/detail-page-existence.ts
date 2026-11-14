import "server-only";

import { registryArtistPageExists } from "@/lib/data/http/artist.server";
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

export { requireLotPage } from "@/lib/marketing/lot-page-existence";
export { requireSalePage } from "@/lib/marketing/sale-page-existence";

/** An artist page exists for a registry artist, and only while the artist pages are on. */
export async function requireArtistPage(artistId: string): Promise<void> {
  if ((await registryArtistPageExists(artistId)) === "missing") notFound();
}
